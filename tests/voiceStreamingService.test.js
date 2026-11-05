import test from 'node:test';
import assert from 'node:assert/strict';
import { generateConversationReply } from '../server/services/voiceStreamingService.js';

const systemContext = {
  role: 'system',
  content: 'Order-only assistant. COD confirmation guardrail. Saved merchant and order facts are immutable.',
};

function openAiResponse(text) {
  return {
    ok: true,
    status: 200,
    async json() {
      return { model: 'gpt-test', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ speech_text: text }) } }] };
    },
  };
}

test('OpenAI turn receives system context and all prior user/assistant messages exactly once', async () => {
  const history = [
    systemContext,
    { role: 'assistant', content: 'আপনার অর্ডারটি কি নিশ্চিত করবেন?' },
    { role: 'user', content: 'হ্যাঁ, আমি অর্ডার করেছি।' },
    { role: 'assistant', content: 'ধন্যবাদ।' },
    { role: 'user', content: 'কবে পাব?' },
  ];
  let body;
  const result = await generateConversationReply({
    provider: 'openai',
    history,
    transcript: 'কবে পাব?',
    env: { OPENAI_API_KEY: 'test-key' },
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/chat/completions');
      body = JSON.parse(options.body);
      return openAiResponse('অর্ডারে নির্দিষ্ট ডেলিভারি তারিখ দেওয়া নেই।');
    },
  });
  assert.equal(result.speechText, 'অর্ডারে নির্দিষ্ট ডেলিভারি তারিখ দেওয়া নেই।');
  assert.deepEqual(body.messages, history);
  assert.equal(body.messages[0].role, 'system');
});

test('Gemini maps saved assistant history to model turns while retaining the systemContext', async () => {
  let body;
  const result = await generateConversationReply({
    provider: 'gemini',
    history: [systemContext, { role: 'assistant', content: 'স্বাগতম।' }, { role: 'user', content: 'ধন্যবাদ।' }],
    transcript: 'ধন্যবাদ।',
    env: { GEMINI_API_KEY: 'test-key' },
    fetchImpl: async (url, options) => {
      assert.match(url, /generateContent$/);
      body = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            modelVersion: 'gemini-test',
            candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ speech_text: 'আপনাকেও ধন্যবাদ।' }) }] } }],
          };
        },
      };
    },
  });
  assert.equal(result.provider, 'gemini');
  assert.equal(result.speechText, 'আপনাকেও ধন্যবাদ।');
  assert.equal(body.systemInstruction.parts[0].text, systemContext.content);
  assert.equal(body.contents[0].role, 'model');
  assert.equal(body.contents[1].role, 'user');
});

test('rejects a turn without the order system context', async () => {
  await assert.rejects(
    generateConversationReply({
      provider: 'openai',
      history: [{ role: 'assistant', content: 'hello' }],
      transcript: 'hi',
      env: { OPENAI_API_KEY: 'test-key' },
      fetchImpl: async () => openAiResponse('hello'),
    }),
    error => error.code === 'VOICE_CONTEXT_MISSING',
  );
});

test('rejects an empty transcript before invoking the provider', async () => {
  let called = false;
  await assert.rejects(
    generateConversationReply({
      provider: 'openai',
      history: [systemContext],
      transcript: ' ',
      env: { OPENAI_API_KEY: 'test-key' },
      fetchImpl: async () => { called = true; return openAiResponse('hello'); },
    }),
    error => error.code === 'EMPTY_TRANSCRIPT',
  );
  assert.equal(called, false);
});
