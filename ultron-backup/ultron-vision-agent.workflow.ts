import { workflow, trigger, node, newCredential, expr } from '@n8n/workflow-sdk';

// ULTRON - Vision Agent
// Send an image (upload via webhook, or image URL) + optional question.
// Gemini vision analyzes it; ULTRON answers + speaks via MiniMax.

const called_as_Sub_workflow = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'Called as Sub-workflow', parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [{ name: 'image_url', type: 'string' }, { name: 'question', type: 'string' }, { name: 'personality', type: 'string' }, { name: 'session_id', type: 'string' }] } } }
});

// --- Normalize input: figure out if we have a URL or uploaded binary image ---
const normalize_Input = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Normalize Input',
    parameters: {
      jsCode: `const raw = $input.item.json;
const src = (raw && raw.body) ? raw.body : raw;
const personality = ((src.personality || 'ULTRON') + '').toUpperCase();
const question = (src.question || src.text || '').toString().trim();
const imageUrl = (src.image_url || src.url || '').toString().trim();
// Binary image?
const bin = $input.item.binary || {};
const binKeys = Object.keys(bin);
const imgKey = binKeys.find(k => k === 'image' || k === 'data' || k.startsWith('image')) || binKeys[0];
function fail(m){ return [{ json: { success:false, error:m } }]; }
if (!imageUrl && !imgKey) return fail('No image provided. Send an image file or an image_url.');
return [{ json: {
  success: true,
  personality,
  question: question || 'Describe this image in detail. What is it? What are the key elements, text, and anything notable?',
  imageUrl,
  hasBinary: !!imgKey,
  binaryField: imgKey || 'image'
} }];`
    }
  }
});

const valid = node({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: { name: 'Valid?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'ok', leftValue: expr('{{ $json.success }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } } }
});

const has_URL = node({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: { name: 'Has URL?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'u', leftValue: expr('{{ $json.hasBinary }}'), rightValue: true, operator: { type: 'boolean', operation: 'false', singleValue: true } }], combinator: 'and' } } }
});

// --- Vision analysis (URL path) via OpenRouter free vision model ---
const analyze_URL = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Analyze Image (URL)',
    onError: 'continueErrorOutput',
    parameters: {
      method: 'POST',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ model: "google/gemma-4-26b-a4b-it:free", messages: [ { role: "user", content: [ { type: "text", text: $json.question }, { type: "image_url", image_url: { url: $json.imageUrl } } ] } ] }) }}'),
      options: { timeout: 90000, response: { response: { responseFormat: 'json' } } }
    },
    credentials: { openAiApi: newCredential('OpenRouter Free (Hassan)', '7KPXGh1aa4Ob25rQ') }
  }
});

// --- Vision analysis (binary upload path): base64 data-URI via OpenRouter ---
const analyze_Binary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Analyze Image (Upload)',
    onError: 'continueErrorOutput',
    parameters: {
      jsCode: `const prep = $input.item.json;
const field = prep.binaryField || 'image';
const buf = await this.helpers.getBinaryDataBuffer(0, field);
const b64 = buf.toString('base64');
const mime = ($input.item.binary && $input.item.binary[field] && $input.item.binary[field].mimeType) || 'image/jpeg';
const dataUri = 'data:' + mime + ';base64,' + b64;
const body = { model: 'google/gemma-4-26b-a4b-it:free', messages: [ { role: 'user', content: [ { type: 'text', text: prep.question }, { type: 'image_url', image_url: { url: dataUri } } ] } ] };
return [{ json: { body: JSON.stringify(body) } }];`
    }
  }
});

const analyze_Binary_Call = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Analyze Upload Call',
    onError: 'continueErrorOutput',
    parameters: {
      method: 'POST',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
      sendBody: true,
      contentType: 'raw',
      rawContentType: 'application/json',
      body: expr('{{ $json.body }}'),
      options: { timeout: 90000, response: { response: { responseFormat: 'json' } } }
    },
    credentials: { openAiApi: newCredential('OpenRouter Free (Hassan)', '7KPXGh1aa4Ob25rQ') }
  }
});

// --- Build result + spoken response text ---
const build_Result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Result',
    parameters: {
      jsCode: `const prep = $('Normalize Input').item.json;
function extractText(j){
  if(!j||typeof j!=='object')return undefined;
  if(typeof j.text==='string'&&j.text.trim())return j.text;
  if(j.content&&j.content.parts&&j.content.parts[0]&&typeof j.content.parts[0].text==='string')return j.content.parts[0].text;
  if(j.candidates&&j.candidates[0]&&j.candidates[0].content&&j.candidates[0].content.parts&&j.candidates[0].content.parts[0])return j.candidates[0].content.parts[0].text;
  if(Array.isArray(j.output)){for(const o of j.output){if(Array.isArray(o.content)){for(const c of o.content){if(typeof c.text==='string'&&c.text.trim())return c.text;}}}}
  return undefined;
}
const analysis = extractText($input.item.json) || 'I could not analyze this image clearly.';
const p = prep.personality;
// Clean for speech
const spoken = analysis.replace(/[*_#\`\\[\\]]/g,'').replace(/\\s+/g,' ').trim();
return [{ json: {
  success: true,
  personality: p,
  question: prep.question,
  analysis,
  response: spoken
} }];`
    }
  }
});

// --- Speak via MiniMax ---
const speak = node({
  type: '@n8n/n8n-nodes-langchain.minimax',
  version: 1.1,
  config: {
    name: 'Speak Answer',
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'audio',
      operation: 'textToSpeech',
      modelId: 'speech-2.8-hd',
      text: expr('{{ $json.response }}'),
      voiceId: expr("{{ $json.personality === 'NOVA' ? 'English_SereneWoman' : 'English_ManWithDeepVoice' }}"),
      downloadAudio: true,
      options: { audioFormat: 'mp3', emotion: expr("{{ $json.personality === 'NOVA' ? 'happy' : 'calm' }}"), pitch: expr("{{ $json.personality === 'NOVA' ? 1 : -2 }}"), speed: 1 }
    },
    credentials: { minimaxApi: newCredential('Gateway credits') }
  }
});

// --- Attach audio as base64 ---
const attach_Audio = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Attach Audio',
    parameters: {
      jsCode: `const res = $('Build Result').item.json;
const out = Object.assign({}, res);
const bin = $input.item.binary || {};
const key = Object.keys(bin)[0];
if (key && bin[key]) {
  try { const buf = await this.helpers.getBinaryDataBuffer(0, key); out.audio_base64 = buf.toString('base64'); out.audio_mime = bin[key].mimeType || 'audio/mpeg'; out.speech = true; }
  catch(e){ out.speech = false; }
} else { out.speech = false; }
return [{ json: out }];`
    }
  }
});

const respond_Result = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Respond Result', parameters: { respondWith: 'json', responseBody: expr('{{ $json }}') } }
});

const respond_Error = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Respond Error', parameters: { respondWith: 'json', responseBody: expr('{{ $json }}') } }
});

const receive_Request = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2,
  config: { name: 'Receive Request', parameters: { httpMethod: 'POST', path: 'ultron-vision', responseMode: 'responseNode', options: { binaryData: true, binaryPropertyName: 'image' } } }
});

const wf = workflow('', 'ULTRON - Vision Agent', { executionOrder: 'v1', binaryMode: 'separate' });

export default wf
  .group('Analyze & speak', [normalize_Input, valid, has_URL, analyze_URL, analyze_Binary, analyze_Binary_Call, build_Result, speak, attach_Audio, respond_Result, respond_Error], { description: 'Receives an image (upload or URL), analyzes it with a vision AI, and returns a spoken answer with audio.' })
  .add(called_as_Sub_workflow)
  .to(normalize_Input)
  .to(valid.onTrue(has_URL
    .onTrue(analyze_URL.to(build_Result))
    .onFalse(analyze_Binary.to(analyze_Binary_Call).to(build_Result))).onFalse(respond_Error))
  .add(build_Result)
  .to(speak)
  .to(attach_Audio)
  .to(respond_Result)
  .add(receive_Request)
  .to(normalize_Input)
