import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createVoiceStreamingService } from '../server/services/voiceStreamingService.js';

const merchantId = '11111111-1111-4111-8111-111111111111';
const orderId = '22222222-2222-4222-8222-222222222222';
const secret = 'merchant-webhook-secret-0123456789abcdef';

class FakeClient extends EventEmitter {
  constructor() {
    super();
    this.readyState = 1;
    this.bufferedAmount = 0;
    this.sent = [];
    FakeClient.latest = this;
  }

  send(payload, options, callback) {
    this.sent.push(payload);
    const done = typeof options === 'function' ? options : callback;
    done?.(null);
  }

  ping() {}
  terminate() { this.close(1006, 'terminated'); }
  close() {
    if (this.readyState !== 1) return;
    this.readyState = 3;
    this.emit('close');
  }
}

class FakeDeepgram extends EventEmitter {
  constructor() {
    super();
    this.readyState = 0;
    this.bufferedAmount = 0;
    queueMicrotask(() => {
      this.readyState = 1;
      this.emit('open');
    });
  }

  send() {}
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit('close');
  }
}

class FakeWebSocketServer {
  constructor() { FakeWebSocketServer.latest = this; }
  handleUpgrade(_request, _socket, _head, callback) { callback(new FakeClient()); }
  close() {}
}

class FakeHttpServer extends EventEmitter {}

function wavPayload() {
  const wav = Buffer.alloc(48);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(40, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(24000, 24);
  wav.writeUInt32LE(48000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(4, 40);
  return wav.toString('base64');
}

async function waitFor(predicate, timeoutMs = 1000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for fake voice session.');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

function createMemoryBillingQueue(pool, finalizer) {
  const pending = [];
  const started = new Map();
  return {
    async beginSession(job) { started.set(job.sessionId, job); },
    async recordHeartbeat() {},
    async enqueueFinalization(job) { pending.push(job); },
    async drain({ maxJobs = 1 } = {}) {
      let processed = 0;
      while (pending.length && processed < maxJobs) {
        const job = pending.shift();
        await finalizer({ pool, ...job });
        processed += 1;
      }
      return processed;
    },
    async start() {},
    async stop() {},
    pending,
    started,
  };
}

async function openVoiceSession(t, {
  initialOk = true,
  billingFinalizer = async () => ({ billedAmount: 1.25, currency: 'BDT', billingSource: 'wallet' }),
} = {}) {
  const pool = {
    async query(sql, params) {
      if (sql.includes('SELECT id, webhook_secret')) {
        assert.deepEqual(params, [secret]);
        return { rows: [{ id: merchantId, webhook_secret: secret }] };
      }
      if (sql.includes('SELECT id FROM public.orders')) {
        assert.deepEqual(params, [orderId, merchantId]);
        return { rows: [{ id: orderId }] };
      }
      if (sql.includes('FROM public.system_settings AS settings')) {
        return { rows: [] };
      }
      throw new Error('Unexpected auth query: ' + sql);
    },
  };

  const billingQueue = createMemoryBillingQueue(pool, billingFinalizer);
  const service = createVoiceStreamingService({
    pool,
    env: {
      DEEPGRAM_API_KEY: 'deepgram-test-key',
      GOOGLE_TTS_ACCESS_TOKEN: 'google-tts-test-token',
      OPENAI_API_KEY: 'openai-test-key',
      VOICE_HEARTBEAT_MS: '60000',
      VOICE_MAX_SESSION_MS: '60000',
    },
    logger: { info() {}, warn() {}, error() {} },
    WebSocketClass: FakeDeepgram,
    WebSocketServerClass: FakeWebSocketServer,
    initialScriptGenerator: async () => initialOk
      ? {
          ok: true,
          speechText: 'আপনার অর্ডারটি নিশ্চিত করবেন?',
          systemContext: { role: 'system', content: 'Order context.' },
        }
      : { ok: false },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() { return { audioContent: wavPayload() }; },
    }),
    billingFinalizer,
    billingQueue,
  });

  const httpServer = new FakeHttpServer();
  service.attach(httpServer);
  // FakeClient.latest is shared across tests in this file. A previous test's
  // client already carries a session.ready message, so without resetting it
  // the wait below would return immediately with the stale client and the
  // new session would never be observed (billing then never fires, or a
  // never-ready session appears to have a ready message).
  FakeClient.latest = null;
  const rawSocket = { destroyed: false, write() {}, destroy() { this.destroyed = true; } };
  httpServer.emit('upgrade', {
    url: `/ws/voice?order_id=${orderId}`,
    headers: { authorization: `Bearer ${secret}` },
  }, rawSocket, Buffer.alloc(0));

  await waitFor(() => FakeClient.latest?.sent.some(value => {
    if (typeof value !== 'string') return false;
    try { return JSON.parse(value).type === 'session.ready'; } catch { return false; }
  }) || (!initialOk && FakeClient.latest?.readyState === 3));

  t.after(() => {
    FakeClient.latest?.close();
    service.close();
  });

  return { service, client: FakeClient.latest };
}

function readyMessage(client) {
  return client.sent
    .filter(value => typeof value === 'string')
    .map(value => { try { return JSON.parse(value); } catch { return null; } })
    .find(value => value?.type === 'session.ready');
}

test('session.end triggers one asynchronous billing finalization using the ready session ID', async t => {
  const calls = [];
  const { client } = await openVoiceSession(t, {
    billingFinalizer: async input => {
      calls.push(input);
      return { billedAmount: 1.25, currency: 'BDT', billingSource: 'wallet' };
    },
  });

  const ready = readyMessage(client);
  assert.ok(ready?.session_id);
  await new Promise(resolve => setTimeout(resolve, 25));
  client.emit('message', Buffer.from(JSON.stringify({ type: 'session.end' })), false);

  await waitFor(() => calls.length === 1);
  assert.equal(client.readyState, 3);
  assert.equal(calls[0].merchantId, merchantId);
  assert.equal(calls[0].orderId, orderId);
  assert.equal(calls[0].sessionId, ready.session_id);
  assert.ok(calls[0].durationSeconds >= 0.02);
  assert.equal(typeof calls[0].durationSeconds, 'number');
});

test('client disconnect triggers billing only once even when cleanup is reached again', async t => {
  const calls = [];
  const { client } = await openVoiceSession(t, {
    billingFinalizer: async input => {
      calls.push(input);
      return { billedAmount: 0.12, currency: 'BDT', billingSource: 'wallet' };
    },
  });

  await new Promise(resolve => setTimeout(resolve, 20));
  client.close();
  client.emit('error', new Error('late close error'));
  await waitFor(() => calls.length === 1);
  assert.equal(calls.length, 1);
});

test('sessions that never reach session.ready are not billed', async t => {
  const calls = [];
  const { client } = await openVoiceSession(t, {
    initialOk: false,
    billingFinalizer: async input => { calls.push(input); },
  });

  assert.equal(readyMessage(client), undefined);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(calls.length, 0);
});

test('socket teardown does not await a slow billing database operation', async t => {
  let billingStarted = false;
  let releaseBilling;
  const pendingBilling = new Promise(resolve => { releaseBilling = resolve; });
  const { client } = await openVoiceSession(t, {
    billingFinalizer: async () => {
      billingStarted = true;
      await pendingBilling;
      return { billedAmount: 1, currency: 'BDT', billingSource: 'wallet' };
    },
  });

  await new Promise(resolve => setTimeout(resolve, 20));
  client.close();
  assert.equal(client.readyState, 3);
  await waitFor(() => billingStarted);
  releaseBilling();
});
