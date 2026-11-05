import crypto from 'node:crypto';
import { URL } from 'node:url';
import WebSocket, { WebSocketServer } from 'ws';
import { generateOrderVoiceScript } from './aiPromptService.js';

const ORDER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_HISTORY = 14;

class VoiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'VoiceError';
    this.code = code;
  }
}

function logSafe(logger, level, event, details = {}) {
  try { logger?.[level]?.('[KashNode Voice]', { event, ...details }); } catch { /* never let logging crash a session */ }
}

function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
}

function normalizeProvider(value) {
  const provider = String(value || 'openai').trim().toLowerCase();
  return ['google', 'google-gemini'].includes(provider) ? 'gemini' : provider;
}

function llmConfig(provider, env) {
  const table = {
    openai: { key: env.OPENAI_API_KEY, model: env.OPENAI_MODEL || 'gpt-4o-mini', endpoint: 'https://api.openai.com/v1/chat/completions' },
    gemini: { key: env.GEMINI_API_KEY || env.GOOGLE_API_KEY, model: env.GEMINI_MODEL || 'gemini-3.6-flash' },
    groq: { key: env.GROQ_API_KEY, model: env.GROQ_MODEL || 'llama-3.3-70b-versatile', endpoint: 'https://api.groq.com/openai/v1/chat/completions' },
  };
  const config = table[provider];
  if (!config) throw new VoiceError('UNSUPPORTED_PROVIDER', 'VOICE_LLM_PROVIDER must be openai, gemini, or groq.');
  if (!config.key) throw new VoiceError('LLM_NOT_CONFIGURED', 'The selected voice LLM provider is not configured.');
  return config;
}

function cleanText(value, limit = 1200) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
  return text && !/<\/?(script|html|ssml|speak|break)\b/i.test(text) ? text : null;
}

function configFromEnv(env) {
  const config = {
    path: env.VOICE_WS_PATH || '/ws/voice',
    sttModel: env.DEEPGRAM_STT_MODEL || 'nova-3',
    sttLanguage: env.DEEPGRAM_STT_LANGUAGE || 'bn',
    language: env.VOICE_LANGUAGE || 'bn-BD',
    provider: normalizeProvider(env.VOICE_LLM_PROVIDER || 'openai'),
    inputRate: Number(env.VOICE_SAMPLE_RATE || 16000),
    outputRate: Number(env.VOICE_TTS_SAMPLE_RATE || 24000),
    ttsLanguage: env.GOOGLE_TTS_LANGUAGE || 'bn-IN',
    ttsVoice: env.GOOGLE_TTS_VOICE || 'bn-IN-Wavenet-A',
    maxSessions: Number(env.VOICE_MAX_SESSIONS_PER_MERCHANT || 2),
    maxFrameBytes: Number(env.VOICE_MAX_AUDIO_FRAME_BYTES || 65536),
    maxBufferedBytes: Number(env.VOICE_MAX_BUFFERED_BYTES || 524288),
    maxTurns: Number(env.VOICE_MAX_TURNS || 30),
    maxSessionMs: Number(env.VOICE_MAX_SESSION_MS || 600000),
    upstreamTimeoutMs: Number(env.VOICE_UPSTREAM_TIMEOUT_MS || 12000),
    llmTimeoutMs: Number(env.VOICE_LLM_TIMEOUT_MS || 18000),
    ttsTimeoutMs: Number(env.VOICE_TTS_TIMEOUT_MS || 25000),
    heartbeatMs: Number(env.VOICE_HEARTBEAT_MS || 30000),
  };
  const limits = [
    config.inputRate, config.outputRate, config.maxSessions, config.maxFrameBytes,
    config.maxBufferedBytes, config.maxTurns, config.maxSessionMs,
    config.upstreamTimeoutMs, config.llmTimeoutMs, config.ttsTimeoutMs, config.heartbeatMs,
  ];
  if (limits.some(value => !Number.isSafeInteger(value) || value <= 0)) {
    throw new VoiceError('VOICE_CONFIG_INVALID', 'Voice runtime limits must be positive integers.');
  }
  if (config.inputRate !== 16000 || config.outputRate !== 24000) {
    throw new VoiceError('VOICE_CONFIG_INVALID', 'The audio contract requires 16 kHz input and 24 kHz output.');
  }
  if (!['openai', 'gemini', 'groq'].includes(config.provider)) {
    throw new VoiceError('UNSUPPORTED_PROVIDER', 'VOICE_LLM_PROVIDER must be openai, gemini, or groq.');
  }
  return config;
}

async function readJson(response, code = 'PROVIDER_INVALID_RESPONSE') {
  let payload;
  try { payload = await response.json(); } catch { throw new VoiceError(code, 'Provider returned invalid JSON.'); }
  if (!response.ok) throw new VoiceError('PROVIDER_REQUEST_FAILED', 'A voice provider request failed.');
  return payload;
}

/**
 * Run one LLM turn using the complete ordered conversation history.
 * history[0] must be aiPromptService.systemContext. The calling session appends
 * the user message before calling; this function avoids duplicating that turn.
 */
export async function generateConversationReply({
  provider = 'openai',
  history,
  transcript,
  env = process.env,
  fetchImpl = globalThis.fetch,
  timeoutMs = 18000,
} = {}) {
  const selected = normalizeProvider(provider);
  const utterance = cleanText(transcript);
  if (!utterance) throw new VoiceError('EMPTY_TRANSCRIPT', 'No customer speech was recognized.');
  if (!Array.isArray(history) || history[0]?.role !== 'system' || typeof history[0]?.content !== 'string') {
    throw new VoiceError('VOICE_CONTEXT_MISSING', 'Initial order system context is unavailable.');
  }
  if (typeof fetchImpl !== 'function') throw new VoiceError('FETCH_UNAVAILABLE', 'Node fetch is unavailable.');
  const config = llmConfig(selected, env);
  const last = history[history.length - 1];
  const messages = last?.role === 'user' && last.content === utterance
    ? [...history]
    : [...history, { role: 'user', content: utterance }];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let content;
    let model = config.model;
    if (selected === 'gemini') {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`;
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.key },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: messages[0].content }] },
          contents: messages.slice(1).map(message => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: message.content }],
          })),
          generationConfig: { temperature: 0.2, maxOutputTokens: 280, responseMimeType: 'application/json' },
        }),
      });
      const payload = await readJson(response);
      const candidate = payload.candidates?.[0];
      if (!candidate || ['SAFETY', 'MAX_TOKENS'].includes(candidate.finishReason)) {
        throw new VoiceError('LLM_EMPTY_RESPONSE', 'The model returned no complete response.');
      }
      content = candidate.content?.parts?.map(part => part.text || '').join('');
      model = payload.modelVersion || config.model;
    } else {
      const response = await fetchImpl(config.endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.2,
          max_tokens: 280,
          response_format: { type: 'json_object' },
        }),
      });
      const payload = await readJson(response);
      const choice = payload.choices?.[0];
      if (!choice || ['length', 'content_filter'].includes(choice.finish_reason)) {
        throw new VoiceError('LLM_EMPTY_RESPONSE', 'The model returned no complete response.');
      }
      content = choice.message?.content;
      model = payload.model || config.model;
    }

    let parsed;
    try { parsed = JSON.parse(content || ''); } catch { throw new VoiceError('LLM_INVALID_OUTPUT', 'Model response was not valid JSON.'); }
    const speechText = cleanText(parsed?.speech_text);
    if (!speechText) throw new VoiceError('LLM_INVALID_OUTPUT', 'Model response was not valid spoken text.');
    return { speechText, provider: selected, model };
  } catch (error) {
    if (error?.name === 'AbortError') throw new VoiceError('LLM_TIMEOUT', 'Voice model timed out.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function deepgramUrl(config) {
  const url = new URL('wss://api.deepgram.com/v1/listen');
  for (const [key, value] of Object.entries({
    model: config.sttModel,
    language: config.sttLanguage,
    encoding: 'linear16',
    sample_rate: String(config.inputRate),
    channels: '1',
    interim_results: 'true',
    endpointing: '300',
    utterance_end_ms: '1000',
    smart_format: 'true',
  })) url.searchParams.set(key, value);
  return url.toString();
}

function openDeepgram(WebSocketClass, url, apiKey, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocketClass(url, {
      headers: { Authorization: `Token ${apiKey}` },
      perMessageDeflate: false,
      handshakeTimeout: timeoutMs,
      maxPayload: 2 * 1024 * 1024,
    });
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      socket.terminate?.();
      reject(new VoiceError('STT_TIMEOUT', 'Speech recognition connection timed out.'));
    }, timeoutMs);
    socket.once('open', () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('error', () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(new VoiceError('STT_UNAVAILABLE', 'Speech recognition is unavailable.'));
    });
    socket.once('close', () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(new VoiceError('STT_DISCONNECTED', 'Speech recognition disconnected during setup.'));
    });
  });
}

const b64url = value => Buffer.from(value).toString('base64url');
let cachedGoogleToken = null;
let cachedGoogleTokenExpiry = 0;

async function googleTtsToken({ env, fetchImpl, timeoutMs }) {
  if (env.GOOGLE_TTS_ACCESS_TOKEN) return env.GOOGLE_TTS_ACCESS_TOKEN;
  if (cachedGoogleToken && cachedGoogleTokenExpiry > Date.now() + 60000) return cachedGoogleToken;
  if (!env.GOOGLE_TTS_SERVICE_ACCOUNT_JSON) {
    throw new VoiceError('TTS_NOT_CONFIGURED', 'Google Cloud TTS credentials are not configured.');
  }
  let credentials;
  try { credentials = JSON.parse(env.GOOGLE_TTS_SERVICE_ACCOUNT_JSON); } catch {
    throw new VoiceError('TTS_NOT_CONFIGURED', 'Google Cloud service account JSON is invalid.');
  }
  if (!credentials.client_email || !credentials.private_key) {
    throw new VoiceError('TTS_NOT_CONFIGURED', 'Google Cloud service account JSON is incomplete.');
  }
  const now = Math.floor(Date.now() / 1000);
  const audience = credentials.token_uri || 'https://oauth2.googleapis.com/token';
  const unsigned = [
    b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
    b64url(JSON.stringify({
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: audience,
      iat: now,
      exp: now + 3600,
    })),
  ].join('.');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(credentials.private_key, 'base64url')}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(audience, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: controller.signal,
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    const payload = await readJson(response, 'TTS_AUTH_FAILED');
    if (!payload.access_token) throw new VoiceError('TTS_AUTH_FAILED', 'Google Cloud did not issue an access token.');
    cachedGoogleToken = payload.access_token;
    cachedGoogleTokenExpiry = Date.now() + Number(payload.expires_in || 3600) * 1000;
    return cachedGoogleToken;
  } catch (error) {
    if (error?.name === 'AbortError') throw new VoiceError('TTS_TIMEOUT', 'Google Cloud authentication timed out.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function wavPcm(buffer) {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new VoiceError('TTS_INVALID_AUDIO', 'TTS provider returned an invalid WAV payload.');
  }
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const begin = offset + 8;
    if (id === 'data') return buffer.subarray(begin, Math.min(begin + size, buffer.length));
    offset = begin + size + (size % 2);
  }
  throw new VoiceError('TTS_INVALID_AUDIO', 'WAV payload does not contain a PCM data chunk.');
}

async function streamGoogleTts({ session, text, turnId, config, env, fetchImpl }) {
  if (session.closed) return;
  session.isSpeaking = true;
  let timer;
  try {
    const token = await googleTtsToken({ env, fetchImpl, timeoutMs: config.upstreamTimeoutMs });
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), config.ttsTimeoutMs);
    sendJson(session.client, {
      type: 'audio.start',
      turn_id: turnId,
      format: 'pcm_s16le',
      sample_rate: config.outputRate,
      channels: 1,
      language: config.ttsLanguage,
    });
    const response = await fetchImpl('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: config.ttsLanguage, name: config.ttsVoice },
        audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: config.outputRate, speakingRate: 1 },
      }),
    });
    const payload = await readJson(response, 'TTS_FAILED');
    if (typeof payload.audioContent !== 'string') throw new VoiceError('TTS_FAILED', 'Speech synthesis returned no audio.');
    const pcm = wavPcm(Buffer.from(payload.audioContent, 'base64'));
    for (let offset = 0; offset < pcm.length; offset += 4096) {
      if (session.closed) return;
      if (session.client.bufferedAmount > config.maxBufferedBytes) {
        throw new VoiceError('CLIENT_BACKPRESSURE', 'Android client is not consuming audio quickly enough.');
      }
      const chunk = pcm.subarray(offset, Math.min(offset + 4096, pcm.length));
      await new Promise((resolve, reject) => {
        session.client.send(chunk, { binary: true }, error => error ? reject(error) : resolve());
      });
    }
    sendJson(session.client, { type: 'audio.end', turn_id: turnId });
  } catch (error) {
    if (error?.name === 'AbortError') throw new VoiceError('TTS_TIMEOUT', 'Speech synthesis timed out.');
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    session.isSpeaking = false;
  }
}

function sendJson(socket, payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  try { socket.send(JSON.stringify(payload)); return true; } catch { return false; }
}

function rejectUpgrade(socket, status, message) {
  if (socket.destroyed) return;
  const reason = { 400: 'Bad Request', 401: 'Unauthorized', 409: 'Conflict', 429: 'Too Many Requests', 503: 'Service Unavailable' }[status] || 'Error';
  const body = JSON.stringify({ status: 'error', message });
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  socket.destroy();
}

function errorCode(error) {
  const allowed = new Set([
    'EMPTY_TRANSCRIPT', 'VOICE_CONTEXT_MISSING', 'LLM_NOT_CONFIGURED',
    'UNSUPPORTED_PROVIDER', 'LLM_TIMEOUT', 'LLM_REQUEST_FAILED',
    'LLM_INVALID_RESPONSE', 'LLM_INVALID_OUTPUT', 'LLM_EMPTY_RESPONSE',
    'TTS_NOT_CONFIGURED', 'TTS_AUTH_FAILED', 'TTS_FAILED', 'TTS_TIMEOUT',
    'TTS_INVALID_AUDIO', 'STT_FAILED', 'STT_TIMEOUT', 'STT_UNAVAILABLE',
    'STT_DISCONNECTED', 'CLIENT_BACKPRESSURE',
  ]);
  return allowed.has(error?.code) ? error.code : 'VOICE_RUNTIME_ERROR';
}

/**
 * /ws/voice protocol:
 * - Upgrade query: ?order_id=<public.orders UUID>
 * - Auth: Authorization: Bearer <merchants.webhook_secret>
 * - Client binary: mono PCM16LE 16 kHz frames (max 64 KiB by default)
 * - Client JSON: {"type":"audio.end"} | {"type":"session.end"} | {"type":"ping"}
 * - Server binary: PCM16LE 24 kHz Google TTS audio frames
 * - Server JSON: session.ready, transcript.partial/final, assistant.text,
 *   audio.start/end, error, session.ended
 */
export function createVoiceStreamingService({
  pool,
  env = process.env,
  logger = console,
  WebSocketClass = WebSocket,
  WebSocketServerClass = WebSocketServer,
  initialScriptGenerator = generateOrderVoiceScript,
  replyGenerator = generateConversationReply,
  fetchImpl = globalThis.fetch,
} = {}) {
  const config = configFromEnv(env);
  const wss = new WebSocketServerClass({
    noServer: true,
    maxPayload: config.maxFrameBytes,
    perMessageDeflate: false,
  });
  const byOrder = new Map();
  const merchantCounts = new Map();

  async function authenticate(request, url) {
    if (!pool?.query) throw new VoiceError('DATABASE_UNAVAILABLE', 'Voice database unavailable.');
    if (!env.DEEPGRAM_API_KEY) throw new VoiceError('STT_NOT_CONFIGURED', 'Speech recognition is not configured.');
    if (!env.GOOGLE_TTS_ACCESS_TOKEN && !env.GOOGLE_TTS_SERVICE_ACCOUNT_JSON) {
      throw new VoiceError('TTS_NOT_CONFIGURED', 'Bengali speech synthesis is not configured.');
    }
    llmConfig(config.provider, env);
    const orderId = url.searchParams.get('order_id') || '';
    if (!ORDER_ID_RE.test(orderId)) throw new VoiceError('INVALID_ORDER_ID', 'A valid order UUID is required.');
    const authorization = request.headers.authorization || '';
    const secret = authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : request.headers['x-merchant-secret'] || '';
    if (typeof secret !== 'string' || secret.length < 32 || secret.length > 255) {
      throw new VoiceError('INVALID_CREDENTIALS', 'Invalid merchant credentials.');
    }
    const result = await pool.query(
      'SELECT id, webhook_secret FROM public.merchants WHERE webhook_secret = $1 LIMIT 1',
      [secret],
    );
    const merchant = result.rows?.[0];
    if (!merchant?.id || !merchant.webhook_secret || !sameSecret(secret, merchant.webhook_secret)) {
      throw new VoiceError('INVALID_CREDENTIALS', 'Invalid merchant credentials.');
    }
    const order = await pool.query(
      'SELECT id FROM public.orders WHERE id = $1 AND merchant_id = $2 LIMIT 1',
      [orderId, merchant.id],
    );
    if (!order.rows?.[0]) throw new VoiceError('INVALID_CREDENTIALS', 'Invalid merchant credentials or order.');
    return { merchantId: String(merchant.id), orderId: String(order.rows[0].id) };
  }

  function cleanup(session) {
    if (session.closed) return;
    session.closed = true;
    clearInterval(session.heartbeat);
    clearTimeout(session.durationTimer);
    if (byOrder.get(session.key) === session) byOrder.delete(session.key);
    const count = merchantCounts.get(session.merchantId) || 0;
    if (count <= 1) merchantCounts.delete(session.merchantId);
    else merchantCounts.set(session.merchantId, count - 1);
    try { session.stt?.close(); } catch { /* best effort */ }
    logSafe(logger, 'info', 'voice_session_closed', {
      merchantId: session.merchantId,
      orderId: session.orderId,
      turns: session.turnCount,
      durationMs: Date.now() - session.startedAt,
    });
  }

  async function processTranscript(session) {
    if (session.closed) return;
    const transcript = session.parts.join(' ').replace(/\s+/g, ' ').trim();
    session.parts = [];
    if (!transcript) return;
    if (session.pending >= 3) {
      sendJson(session.client, { type: 'error', code: 'TURN_QUEUE_FULL', message: 'Please wait for the current response.' });
      return;
    }
    session.pending += 1;
    session.queue = session.queue.then(async () => {
      try {
        if (session.closed) return;
        if (++session.turnCount > config.maxTurns) {
          sendJson(session.client, { type: 'session.ended', reason: 'max_turns' });
          session.client.close(1000, 'Maximum conversation turns reached');
          cleanup(session);
          return;
        }
        const turnId = session.turnCount;
        session.history.push({ role: 'user', content: transcript });
        sendJson(session.client, { type: 'transcript.final', turn_id: turnId, text: transcript });
        const reply = await replyGenerator({
          provider: config.provider,
          history: session.history,
          transcript,
          env,
          fetchImpl,
          timeoutMs: config.llmTimeoutMs,
        });
        if (session.closed) return;
        session.history.push({ role: 'assistant', content: reply.speechText });
        if (session.history.length > MAX_HISTORY) session.history.splice(1, session.history.length - MAX_HISTORY);
        sendJson(session.client, {
          type: 'assistant.text',
          turn_id: turnId,
          text: reply.speechText,
          provider: reply.provider,
          model: reply.model,
        });
        try {
          await streamGoogleTts({ session, text: reply.speechText, turnId, config, env, fetchImpl });
        } catch (error) {
          logSafe(logger, 'warn', 'voice_tts_failed', { merchantId: session.merchantId, orderId: session.orderId, code: errorCode(error) });
          sendJson(session.client, {
            type: 'error',
            turn_id: turnId,
            code: errorCode(error),
            message: 'The response text is ready, but audio playback failed.',
          });
        }
      } catch (error) {
        logSafe(logger, 'warn', 'voice_turn_failed', { merchantId: session.merchantId, orderId: session.orderId, code: errorCode(error) });
        sendJson(session.client, { type: 'error', code: errorCode(error), message: 'I could not prepare a reply just now. Please repeat that.' });
      } finally {
        session.pending = Math.max(0, session.pending - 1);
      }
    }).catch(() => { session.pending = 0; });
  }

  async function startSession(client, identity) {
    const key = `${identity.merchantId}:${identity.orderId}`;
    const session = {
      ...identity,
      key,
      client,
      stt: null,
      closed: false,
      isSpeaking: false,
      history: [],
      parts: [],
      turnCount: 0,
      pending: 0,
      queue: Promise.resolve(),
      startedAt: Date.now(),
    };
    byOrder.set(key, session);
    merchantCounts.set(identity.merchantId, (merchantCounts.get(identity.merchantId) || 0) + 1);
    client.on('close', () => cleanup(session));
    client.on('error', () => cleanup(session));
    client.on('pong', () => { session.lastPong = true; });
    session.lastPong = true;
    session.heartbeat = setInterval(() => {
      if (session.closed) return;
      if (!session.lastPong) {
        client.terminate();
        return cleanup(session);
      }
      session.lastPong = false;
      try { client.ping(); } catch { cleanup(session); }
    }, config.heartbeatMs);
    session.heartbeat.unref?.();
    session.durationTimer = setTimeout(() => {
      sendJson(client, { type: 'session.ended', reason: 'max_duration' });
      client.close(1000, 'Maximum voice session duration reached');
      cleanup(session);
    }, config.maxSessionMs);
    session.durationTimer.unref?.();

    try {
      const initial = await initialScriptGenerator({
        pool,
        orderId: identity.orderId,
        merchantId: identity.merchantId,
        provider: config.provider,
        language: config.language,
        env,
        logger,
      });
      if (session.closed) return;
      if (!initial?.ok || initial.systemContext?.role !== 'system' || !initial.speechText) {
        sendJson(client, { type: 'error', code: 'INITIAL_CONTEXT_FAILED', message: 'Unable to load the order voice context.' });
        client.close(1011, 'Initial order context failed');
        return cleanup(session);
      }
      // Session memory is seeded once, then appended to for each user/assistant turn.
      session.history = [
        initial.systemContext,
        { role: 'assistant', content: initial.speechText },
      ];
      session.stt = await openDeepgram(
        WebSocketClass,
        deepgramUrl(config),
        env.DEEPGRAM_API_KEY,
        config.upstreamTimeoutMs,
      );
      if (session.closed) {
        session.stt.close();
        return;
      }
      session.stt.on('message', (data, isBinary) => {
        if (session.closed || isBinary) return;
        let event;
        try { event = JSON.parse(data.toString()); } catch { return; }
        if (event.type === 'Results') {
          const text = event.channel?.alternatives?.[0]?.transcript?.trim() || '';
          if (event.is_final && text) session.parts.push(text);
          else if (!event.is_final && text) sendJson(client, { type: 'transcript.partial', text });
          if (event.speech_final) void processTranscript(session);
        } else if (event.type === 'UtteranceEnd') {
          void processTranscript(session);
        } else if (event.type === 'Error') {
          sendJson(client, { type: 'error', code: 'STT_FAILED', message: 'Speech recognition is temporarily unavailable.' });
          client.close(1011, 'Speech recognition failed');
          cleanup(session);
        }
      });
      session.stt.on('error', () => {
        sendJson(client, { type: 'error', code: 'STT_FAILED', message: 'Speech recognition is temporarily unavailable.' });
        client.close(1011, 'Speech recognition failed');
        cleanup(session);
      });
      session.stt.on('close', () => {
        if (!session.closed) {
          sendJson(client, { type: 'error', code: 'STT_DISCONNECTED', message: 'Speech recognition disconnected.' });
          client.close(1011, 'Speech recognition disconnected');
          cleanup(session);
        }
      });

      sendJson(client, {
        type: 'session.ready',
        session_id: crypto.randomUUID(),
        order_id: session.orderId,
        audio: {
          input_format: 'pcm_s16le',
          input_sample_rate: config.inputRate,
          output_format: 'pcm_s16le',
          output_sample_rate: config.outputRate,
          channels: 1,
        },
      });
      sendJson(client, { type: 'assistant.text', turn_id: 0, text: initial.speechText });
      try {
        await streamGoogleTts({ session, text: initial.speechText, turnId: 0, config, env, fetchImpl });
      } catch (error) {
        logSafe(logger, 'warn', 'voice_opening_tts_failed', { merchantId: session.merchantId, orderId: session.orderId, code: errorCode(error) });
        sendJson(client, { type: 'error', code: 'TTS_FAILED', message: 'The opening voice message could not be played.' });
      }
    } catch (error) {
      logSafe(logger, 'error', 'voice_session_start_failed', { merchantId: session.merchantId, orderId: session.orderId, code: errorCode(error) });
      sendJson(client, { type: 'error', code: 'VOICE_SESSION_START_FAILED', message: 'The voice session could not be started.' });
      client.close(1011, 'Voice session could not be started');
      cleanup(session);
    }
  }

  function onClientMessage(session, data, isBinary) {
    if (session.closed) return;
    if (isBinary) {
      const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (!chunk.length || chunk.length > config.maxFrameBytes || chunk.length % 2 !== 0) {
        sendJson(session.client, { type: 'error', code: 'INVALID_AUDIO_FRAME', message: 'Expected a non-empty PCM16 frame within the configured frame size.' });
        return;
      }
      if (session.isSpeaking) return; // Half-duplex echo prevention.
      if (!session.stt || session.stt.readyState !== WebSocket.OPEN) {
        sendJson(session.client, { type: 'error', code: 'STT_NOT_READY', message: 'Speech recognition is not ready.' });
        return;
      }
      if (session.stt.bufferedAmount > config.maxBufferedBytes) {
        sendJson(session.client, { type: 'error', code: 'AUDIO_BACKPRESSURE', message: 'Audio is arriving faster than it can be processed.' });
        session.client.close(1013, 'Audio backpressure');
        return cleanup(session);
      }
      try { session.stt.send(chunk, { binary: true }); } catch {
        sendJson(session.client, { type: 'error', code: 'STT_FAILED', message: 'Audio could not be forwarded.' });
        session.client.close(1011, 'Audio forwarding failed');
        cleanup(session);
      }
      return;
    }
    let message;
    try { message = JSON.parse(data.toString()); } catch {
      sendJson(session.client, { type: 'error', code: 'INVALID_MESSAGE', message: 'Expected a JSON control message.' });
      return;
    }
    if (message?.type === 'audio.end') {
      if (session.stt?.readyState === WebSocket.OPEN) {
        try { session.stt.send(JSON.stringify({ type: 'Finalize' })); } catch { /* upstream closing */ }
      }
    } else if (message?.type === 'session.end') {
      sendJson(session.client, { type: 'session.ended', reason: 'client_request' });
      session.client.close(1000, 'Session ended by client');
      cleanup(session);
    } else if (message?.type === 'ping') {
      sendJson(session.client, { type: 'pong' });
    } else {
      sendJson(session.client, { type: 'error', code: 'UNKNOWN_MESSAGE', message: 'Unsupported control message type.' });
    }
  }

  function handleUpgrade(request, socket, head) {
    let url;
    try { url = new URL(request.url || '/', 'http://localhost'); } catch {
      return rejectUpgrade(socket, 400, 'Invalid WebSocket request.');
    }
    if (url.pathname !== config.path) return;
    (async () => {
      try {
        const identity = await authenticate(request, url);
        const key = `${identity.merchantId}:${identity.orderId}`;
        if (byOrder.has(key)) return rejectUpgrade(socket, 409, 'A voice session is already active for this order.');
        if ((merchantCounts.get(identity.merchantId) || 0) >= config.maxSessions) {
          return rejectUpgrade(socket, 429, 'Merchant voice session limit reached.');
        }
        wss.handleUpgrade(request, socket, head, client => {
          client.on('message', (data, isBinary) => {
            const session = byOrder.get(key);
            if (session) onClientMessage(session, data, isBinary);
          });
          void startSession(client, identity);
        });
      } catch (error) {
        const status = error?.code === 'INVALID_ORDER_ID' ? 400 : error?.code === 'INVALID_CREDENTIALS' ? 401 : 503;
        const message = status === 400 ? 'A valid order_id is required.'
          : status === 401 ? 'Invalid merchant credentials or order.'
            : 'Voice service is unavailable.';
        logSafe(logger, 'warn', 'voice_upgrade_rejected', { code: errorCode(error), status });
        rejectUpgrade(socket, status, message);
      }
    })().catch(() => rejectUpgrade(socket, 503, 'Voice service is unavailable.'));
  }

  function attach(httpServer) {
    httpServer.on('upgrade', handleUpgrade);
    return httpServer;
  }

  function close() {
    for (const session of byOrder.values()) {
      cleanup(session);
      if (session.client.readyState === WebSocket.OPEN) session.client.close(1001, 'Server shutting down');
    }
    wss.close();
  }

  return { attach, close, webSocketServer: wss, activeSessions: byOrder };
}
