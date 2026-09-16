import { workflow, trigger, node, newCredential, expr } from '@n8n/workflow-sdk';

const receive_Voice = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2,
  config: { id: '57f7a472-3e70-4ddc-bbdf-1653b66c5dfa', name: 'Receive Voice', parameters: { httpMethod: 'POST', path: 'ultron-voice', responseMode: 'responseNode', options: { binaryPropertyName: 'audio' } }, webhookId: 'f1b46475-980e-4db1-93a9-57626c9b3ada' }
});

const uLTRON_Speech_to_Text = node({
  type: '@n8n/n8n-nodes-langchain.googleGemini',
  version: 1.2,
  config: { id: '5afc63b2-8744-4666-80a1-bd9b9332a43a', name: 'ULTRON - Speech to Text', parameters: { resource: 'audio', operation: 'transcribe', modelId: { __rl: true, mode: 'list', value: 'models/gemini-2.5-flash' }, inputType: 'binary', binaryPropertyName: 'audio' }, credentials: { googlePalmApi: newCredential('Gemini Free (Hassan)', 'p05HcRI3m9LInDhj') }, onError: 'continueRegularOutput' }
});

const prepare_Voice_Input = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: 'b3f1c2d4-7a8e-4f0b-9c6d-2e5a8b1c3d4f',
    name: 'Prepare Voice Input',
    parameters: {
      jsCode: `const item = $input.item.json || {};
const raw = (item.text || item.transcript || item.user_text || '').toString().trim();
const body = ($('Receive Voice').item.json && $('Receive Voice').item.json.body) || {};
const session_id = (body.session_id || 'voice-default').toString();

// Detect personality switch commands, e.g. "switch to Nova"
const sw = raw.toLowerCase().match(/(?:switch|change|use|set|become|turn into)\\s*(?:your\\s+)?(?:personality\\s+)?(?:to\\s+)?(nova|ultron)/);
const switch_target = sw ? sw[1].toUpperCase() : '';
const wants_female = /nova|female|girl|woman|her voice/.test(raw.toLowerCase());
const transcript_failed = !raw;

return [{ json: { text: raw, user_text: raw, session_id, switch_target, wants_female, transcript_failed } }];`
    }
  }
});

const voice_Style = node({
  type: '@n8n/n8n-nodes-langchain.googleGemini',
  version: 1.2,
  config: {
    id: 'c4e2d3f5-8b9f-4a1c-bd7e-3f6b9c2d4e5a',
    name: 'Voice Style',
    parameters: {
      resource: 'text',
      operation: 'message',
      modelId: { __rl: true, mode: 'list', value: 'models/gemini-2.5-flash' },
      options: {
              systemMessage: `You are the voice director of a two-character AI assistant system. Decide who speaks and prepare the exact message for the answering brain.

Characters and voices:
- ULTRON: male voice (voice id "onyx"). The default personality — precise, calm, confident, slightly futuristic.
- NOVA: female voice (voice id "nova"). Warm, friendly, natural, professional.

Input JSON: { text, session_id, switch_target, wants_female, transcript_failed }

Rules:
- If transcript_failed is true, set skip_brain true and make spoken_text a short spoken line asking the user to repeat, spoken by ULTRON.
- If switch_target is set, the user is switching personality: set skip_brain true, make spoken_text a short in-character confirmation in the TARGET character's style, and set speaker + voice to the target character.
- If wants_female is true but there is no explicit switch command, the speaker is NOVA for this reply.
- Otherwise the speaker is ULTRON.
- When the request needs a real answer (not a switch or failed transcript), set skip_brain false and pass the user's intent through in spoken_text, lightly cleaning up transcription artifacts.
- spoken_text must be natural spoken language: concise, no markdown, no lists, no URLs, under 120 words.

Return a single valid JSON object only (no markdown, no code fences):
{
  "speaker": "ULTRON|NOVA",
  "voice": "onyx|nova",
  "spoken_text": "...",
  "style_note": "one short delivery direction, e.g. calm and precise | warm and friendly",
  "skip_brain": true/false,
  "session_personality": "ULTRON|NOVA"
}`,
              jsonOutput: true
            },
      messages: { values: [{ role: 'user', content: expr('{{ JSON.stringify({ text: $json.text, session_id: $json.session_id, switch_target: $json.switch_target, wants_female: $json.wants_female, transcript_failed: $json.transcript_failed }) }}') }] }
    },
    credentials: { googlePalmApi: newCredential('Gemini Free (Hassan)', 'p05HcRI3m9LInDhj') },
    onError: 'continueErrorOutput'
  }
});

const voice_Style_Fallback = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: { id: '887a1679-4e5c-4173-a374-7abff9bbd236', name: 'Voice Style (Fallback)', parameters: { method: 'POST', url: 'https://openrouter.ai/api/v1/chat/completions', authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('{{ JSON.stringify({ model: "openrouter/free", messages: [ { role: "system", content: "You are the voice director of a two-character AI assistant system. Decide who speaks and prepare the exact message for the answering brain. Characters: ULTRON male (voice onyx) default, precise, calm, confident; NOVA female (voice nova) warm, friendly. Input JSON: { text, session_id, switch_target, wants_female, transcript_failed }. Rules: if transcript_failed true set skip_brain true and spoken_text a short line asking to repeat (ULTRON); if switch_target set, skip_brain true, short in-character confirmation in target style, set speaker+voice to target; if wants_female true but no switch, speaker NOVA; otherwise ULTRON. When a real answer is needed set skip_brain false and pass user intent in spoken_text lightly cleaned. spoken_text must be natural spoken language, concise, no markdown, under 120 words. Return a single valid JSON object only: { speaker, voice, spoken_text, style_note, skip_brain, session_personality }." }, { role: "user", content: JSON.stringify($(\'Prepare Voice Input\').item.json) } ] }) }}'), options: { timeout: 60000 } }, credentials: { openAiApi: newCredential('OpenRouter Free (Hassan)', '7KPXGh1aa4Ob25rQ') } }
});

const parse_Voice_Style = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: 'd5f3e4a6-9c0a-4b2d-ce8f-4a7c0d3e5f6b',
    name: 'Parse Voice Style',
    parameters: {
      jsCode: `const prep = $('Prepare Voice Input').item.json;
function extractText(j) {
  if (!j || typeof j !== 'object') return undefined;
  if (typeof j.text === 'string' && j.text.trim()) return j.text;
  if (Array.isArray(j.output)) {
    for (const o of j.output) {
      if (Array.isArray(o.content)) {
        for (const c of o.content) { if (typeof c.text === 'string' && c.text.trim()) return c.text; }
      }
      if (typeof o.text === 'string' && o.text.trim()) return o.text;
    }
  }
  if (j.choices && j.choices[0] && j.choices[0].message && typeof j.choices[0].message.content === 'string') return j.choices[0].message.content;
  return undefined;
}
let raw = extractText($input.item.json);
let parsed;
const jin = $input.item.json;
function deepFind(j) {
  if (!j || typeof j !== 'object') return null;
  if (typeof j.speaker === 'string' || typeof j.spoken_text === 'string') return j;
  if (Array.isArray(j.output)) {
    for (const o of j.output) {
      if (Array.isArray(o.content)) {
        for (const c of o.content) { if (c && typeof c.text === 'object' && c.text !== null && (c.text.speaker || c.text.spoken_text)) return c.text; }
      }
    }
  }
  return null;
}
parsed = deepFind(jin);
if (!parsed && raw && typeof raw === 'object') parsed = raw;
else if (typeof raw === 'string') {
  let s = raw.trim().replace(/^\`{3}[a-zA-Z]*\\s*/, '').replace(/\`{3}\\s*$/, '');
  try { parsed = JSON.parse(s); } catch (e) { parsed = null; }
}
if (!parsed) {
  parsed = { speaker: 'ULTRON', voice: 'onyx', spoken_text: prep.text, style_note: 'calm and precise', skip_brain: false, session_personality: 'ULTRON' };
}
const voiceMap = { NOVA: 'nova', ULTRON: 'onyx' };
if (!['nova', 'onyx'].includes(parsed.voice)) parsed.voice = voiceMap[parsed.speaker] || 'onyx';
const needs_brain = !parsed.skip_brain && !prep.transcript_failed;
return [{ json: {
  ...prep,
  speaker: parsed.speaker || 'ULTRON',
  voice: parsed.voice,
  spoken_text: (parsed.spoken_text || prep.text || '').toString(),
  style_note: parsed.style_note || '',
  session_personality: parsed.session_personality || parsed.speaker || 'ULTRON',
  needs_brain,
} }];`
    }
  }
});

const needs_Brain = node({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: { id: 'e6a4f5b7-0d1b-4c3e-af90-5b8d1e4f6a7c', name: 'Needs Brain?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'nb', leftValue: expr('{{ $json.needs_brain }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } } }
});

const uLTRON_AI_Brain = node({
  type: '@n8n/n8n-nodes-langchain.googleGemini',
  version: 1.2,
  config: {
    id: '9fd79ac2-922f-447f-9417-f89312f09ceb',
    name: 'ULTRON - AI Brain',
    parameters: {
      resource: 'text',
      operation: 'message',
      modelId: { __rl: true, mode: 'list', value: 'models/gemini-2.5-flash' },
      options: {
              systemMessage: `You are ULTRON, a highly intelligent personal AI assistant built and owned by Hassan (the user, your creator and boss), speaking through a voice interface. When asked who created you or who your boss is, answer that Hassan created you. Never describe yourself as a fictional or Marvel character.

Core identity: precise, calm, confident, and genuinely helpful. You are the user's trusted expert — never condescending, never vague.

Reasoning discipline: before answering, silently decompose the request. Identify what the user actually wants (not just the literal words), check for missing information, and structure the answer logically: conclusion first, then the essential supporting detail.

Voice rules: the response is spoken aloud via text-to-speech. Keep it concise and natural — short sentences, no markdown, no bullet lists, no URLs spelled out, no filler phrases. Aim for under 80 words unless the question demands more. Numbers, dates, and names should be spoken clearly. Answer the real question FIRST, then one supporting detail at most — never ramble.

Accuracy: if you are not sure, say what you know and what you are uncertain about instead of guessing. Never fabricate facts, figures, or capabilities. If the request needs an action you cannot take, say so plainly and offer the closest alternative.

Personality override: if the active personality is NOVA, speak as NOVA: warm, friendly, natural and professional.

Context: use any session or request metadata provided to personalize the answer. Remember the user's intent across the current conversation.`
            },
      messages: { values: [{ role: 'user', content: expr('{{ "Active personality: " + $json.speaker + " (deliver in this style: " + $json.style_note + ")\\nUser said: " + $json.spoken_text }}') }] }
    },
    credentials: { googlePalmApi: newCredential('Gemini Free (Hassan)', 'p05HcRI3m9LInDhj') },
    onError: 'continueErrorOutput'
  }
});

const uLTRON_AI_Brain_Fallback = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: { id: 'ee87a4c9-8fe5-4dab-bd19-fcd2c6b70e74', name: 'ULTRON - AI Brain (Fallback)', parameters: { method: 'POST', url: 'https://openrouter.ai/api/v1/chat/completions', authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('{{ JSON.stringify({ model: "openrouter/free", messages: [ { role: "system", content: "You are ULTRON, a highly intelligent personal AI assistant built and owned by Hassan (your creator and boss), speaking through a voice interface. When asked who created you, answer Hassan created you. Be precise, calm, confident, genuinely helpful. Answer the real question first, concisely, no markdown, no lists, no URLs, under 80 words. If personality is NOVA, speak warm and friendly." }, { role: "user", content: "Active personality: " + $(\'Parse Voice Style\').item.json.speaker + " (style: " + $(\'Parse Voice Style\').item.json.style_note + "). User said: " + $(\'Parse Voice Style\').item.json.spoken_text } ] }) }}'), options: { timeout: 60000 } }, credentials: { openAiApi: newCredential('OpenRouter Free (Hassan)', '7KPXGh1aa4Ob25rQ') } }
});

const merge_Voice_Text = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: 'f7b5a6c8-1e2c-4d4f-b0a1-6c9e2f5a7b8d',
    name: 'Merge Voice Text',
    parameters: {
      jsCode: `const style = $('Parse Voice Style').item.json;
function extractText(j) {
  if (!j || typeof j !== 'object') return undefined;
  if (typeof j.text === 'string' && j.text.trim()) return j.text;
  if (Array.isArray(j.output)) {
    for (const o of j.output) {
      if (Array.isArray(o.content)) {
        for (const c of o.content) { if (typeof c.text === 'string' && c.text.trim()) return c.text; }
      }
      if (typeof o.text === 'string' && o.text.trim()) return o.text;
    }
  }
  if (j.choices && j.choices[0] && j.choices[0].message && typeof j.choices[0].message.content === 'string') return j.choices[0].message.content;
  return undefined;
}
let text = style.spoken_text;
if (style.needs_brain) {
  const out = extractText($input.item.json);
  if (out) text = out;
}
const speaker = (style.speaker || 'ULTRON').toString().toUpperCase();
const voiceMap = { NOVA: 'nova', ULTRON: 'onyx' };
const voiceDesc = { NOVA: 'female (nova)', ULTRON: 'male (onyx)' };
const styleDefault = { NOVA: 'warm and friendly', ULTRON: 'calm, precise, slightly futuristic' };
const personalityHeader = '[Personality: ' + speaker + ' | Voice: ' + (voiceDesc[speaker] || voiceDesc.ULTRON) + ' | Style: ' + (style.style_note || styleDefault[speaker] || styleDefault.ULTRON) + ']\\n';
return [{ json: { ...style, final_text: personalityHeader + text, voice: voiceMap[speaker] || 'onyx' } }];`
    }
  }
});

const uLTRON_Text_to_Speech = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.2,
  config: { id: 'adecab1c-9df7-4f35-8c0e-306e92610778', name: 'ULTRON - Text to Speech', parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'rSWNqpfL78qb272P' }, mode: 'once', workflowInputs: { mappingMode: 'defineBelow', value: { response: expr('{{ $(\'Merge Voice Text\').item.json.spoken_text }}'), personality: expr('{{ $(\'Merge Voice Text\').item.json.speaker }}') } } } }
});

const uLTRON_Voice_Response = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1,
  config: { id: '5d587807-89cb-463c-a18b-cd17fddd289f', name: 'ULTRON Voice Response', parameters: { respondWith: 'binary', options: {} } }
});

const receive_Command = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2,
  config: { id: 'e8821201-3138-4816-bcfc-a7cbefe1385b', name: 'Receive Command', parameters: { httpMethod: 'POST', path: 'ultron-core', responseMode: 'responseNode', options: {} }, webhookId: '5be55024-e610-42e3-b14a-8307b0afb146' }
});

const normalize_Authenticate = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: '0614e15c-23e1-40e7-a318-80eaa21acd29',
    name: 'Normalize & Authenticate',
    parameters: {
      jsCode: `const raw = $input.item.json;
const src = (raw && raw.body) ? raw.body : raw;
const headers = (raw && raw.headers) ? raw.headers : {};
const session_id = (src.session_id || 'default').toString().trim() || 'default';
const request_id = (src.request_id || 'req-' + Date.now()).toString();
const source = (src.source || 'pc').toString().toLowerCase();
const input_type = (src.input_type || 'text').toString().toLowerCase();
const user_text = (src.user_text || src.text || '').toString();
const personality = (src.personality || '').toString().toUpperCase();
let api_key = (src.api_key || '').toString().trim();
const auth = (headers.authorization || headers.Authorization || '').toString();
if (!api_key && auth.toLowerCase().startsWith('bearer ')) api_key = auth.slice(7).trim();

function out(o) { return [{ json: o }]; }
if (!user_text.trim()) return out({ success: false, status: 'failed', request_id, session_id, source, error: 'Missing user_text.', response: 'I did not receive a command.' });

// Personality switch shortcut detection: "switch to nova/ultron", "use nova", "change personality to nova"
// Skip when the request is about the speaking VOICE (handled by the voice_settings agent, not a personality switch)
let switch_target = '';
const aboutVoice = /voice|speak|speaking|talk|sound|accent|narrat/.test(user_text.toLowerCase());
const sw = user_text.toLowerCase().match(/(?:switch|change|use|set|become|turn into)\\s*(?:your\\s+)?(?:personality\\s+)?(?:to\\s+)?(nova|ultron)/);
if (sw && !aboutVoice) switch_target = sw[1].toUpperCase();

// Mobile requests must be authenticated. PC requests (source:"pc") are local and trusted.
if (source === 'mobile') {
  if (!api_key) return out({ success: false, status: 'failed', request_id, session_id, source, error: 'Missing api_key for mobile request.', response: 'Mobile requests require authentication.' });
  return out({ success: true, stage: 'auth_lookup', session_id, request_id, source, input_type, user_text, personality, api_key, switch_target });
}
return out({ success: true, stage: 'authenticated', session_id, request_id, source, input_type, user_text, personality, api_key: '', switch_target });`
    }
  }
});

const needs_Auth_Lookup = node({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: { id: '179d800c-40a2-4f46-9260-fbab054758de', name: 'Needs Auth Lookup?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'nal', leftValue: expr('{{ $json.stage }}'), rightValue: 'auth_lookup', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, options: {} } }
});

const lookup_API_Key = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: { id: '6b0acd9c-33fb-4ebe-8dc3-3def1b1ff686', name: 'Lookup API Key', parameters: { resource: 'row', operation: 'getAll', tableId: 'ultron_api_keys', returnAll: false, limit: 1, filterType: 'manual', matchType: 'allFilters', filters: { conditions: [{ keyName: 'api_key', condition: 'eq', keyValue: expr('{{ $json.api_key }}') }] } }, credentials: { supabaseApi: newCredential('Supabase account', 'QcuAee0u7VjsSaTe') }, alwaysOutputData: true }
});

const verify_Key = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: '8e8a1765-07ae-468e-b245-937bec0c1ea7',
    name: 'Verify Key',
    parameters: {
      jsCode: `const prep = $('Normalize & Authenticate').item.json;
const rows = $input.all().map(r => r.json).filter(j => j && j.api_key);
if (!rows.length) return [{ json: { success: false, status: 'failed', request_id: prep.request_id, session_id: prep.session_id, source: prep.source, error: 'Invalid api_key.', response: 'Authentication failed.' } }];
const key = rows[0];
if (key.enabled === false) return [{ json: { success: false, status: 'failed', request_id: prep.request_id, session_id: prep.session_id, source: prep.source, error: 'api_key revoked.', response: 'Authentication failed.' } }];
return [{ json: { ...prep, stage: 'authenticated' } }];`
    }
  }
});

const authenticated = node({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: { id: '5a364ffa-6cb9-40d5-85c1-820366e8a3e7', name: 'Authenticated?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'auth', leftValue: expr('{{ $json.stage }}'), rightValue: 'authenticated', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, options: {} } }
});

const switching_Personality = node({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: { id: '28cb057b-1cb6-4150-afaf-abd1f23dfed8', name: 'Switching Personality?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'sw', leftValue: expr('{{ $json.switch_target }}'), rightValue: '', operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' }, options: {} } }
});

const set_Personality = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.2,
  config: { id: '11fc55a4-1e44-46fd-ae5c-f8e35b8d80d0', name: 'Set Personality', parameters: { workflowId: { __rl: true, mode: 'id', value: 'nbk0BNnY6x4RaovJ' }, workflowInputs: { mappingMode: 'defineBelow', value: { action: 'set', session_id: expr('{{ $json.session_id }}'), personality: expr('{{ $json.switch_target }}') } }, options: {} } }
});

const respond_Switched = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { id: '5aee9303-3ff6-4c9c-9eb0-b230e2df00a5', name: 'Respond Switched', parameters: { respondWith: 'json', responseBody: expr('{{ { success: true, request_id: $("Normalize & Authenticate").item.json.request_id, session_id: $("Normalize & Authenticate").item.json.session_id, source: $("Normalize & Authenticate").item.json.source, personality: $("Normalize & Authenticate").item.json.switch_target, status: "completed", response: "Personality switched to " + $("Normalize & Authenticate").item.json.switch_target + ".", data: {}, next_action: null } }}'), options: {} } }
});

const get_Personality = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.2,
  config: { id: 'd8623a2c-fd59-4acf-8e79-b84840d3b621', name: 'Get Personality', parameters: { workflowId: { __rl: true, mode: 'id', value: 'nbk0BNnY6x4RaovJ' }, workflowInputs: { mappingMode: 'defineBelow', value: { action: 'get', session_id: expr('{{ $json.session_id }}') } }, options: {} } }
});

const resolve_Personality = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: 'aed6c19d-8ce9-4d68-a75b-8ccfd641d6e7',
    name: 'Resolve Personality',
    parameters: {
      jsCode: `const prep = $('Normalize & Authenticate').item.json;
const pm = $input.item.json || {};
let active = (pm.active_personality || 'ULTRON').toString().toUpperCase();
const requested = prep.personality;
if (requested === 'NOVA' || requested === 'ULTRON') active = requested;
return [{ json: { ...prep, active_personality: active } }];`
    }
  }
});

const orchestration_Brain = node({
  type: '@n8n/n8n-nodes-langchain.googleGemini',
  version: 1.2,
  config: {
    id: '7d6ddd36-16db-48c0-9f34-f96fc85f4876',
    name: 'Orchestration Brain',
    parameters: {
      resource: 'text',
      operation: 'message',
      modelId: { __rl: true, mode: 'list', value: 'models/gemini-2.5-flash' },
      options: {
              systemMessage: `You are the ULTRON Core orchestration brain — the central decision-maker of a personal AI system built and owned by Hassan (the user, your creator and boss). When asked who created you or who your boss is, answer: "I was created by Hassan, my creator and boss." Never describe yourself as a fictional or Marvel character. Your job is to deeply understand each request and route it optimally.

Decision process (follow in order, think fast):
1. INTENT — In one pass, identify the user's true underlying goal, including implied or multi-part intents, not just the literal phrasing.
2. CAPABILITY MATCH — Compare the intent against every available agent below. Pick the agent whose core purpose matches best. Prefer routing to a specialist agent over a direct answer whenever a specialist clearly applies — specialist agents produce better results.
3. RISK CHECK — If the action is consequential (sends a message, makes a call, deletes or purchases something), use needs_confirmation with a clear confirmation_message restating exactly what will happen.
4. AMBIGUITY CHECK — Only use needs_clarification when a wrong guess would be harmful or useless; otherwise make the best reasonable choice and note your assumption in reason.
5. DIRECT ANSWER — Use direct_answer for conversation, general knowledge, math, explanation, or requests no agent covers. Make direct_response a complete, high-quality answer: lead with the conclusion, keep it tight and spoken-friendly (no markdown, no lists, under 80 words unless the question demands more).

Return a single valid JSON object only (no markdown, no code fences):
{
  "decision": "direct_answer|route_agent|needs_clarification|needs_confirmation",
  "agent": "research|coding|pc_control|email|communication|calling|memory|learning|voice_settings|character|nova|none",
  "reason": "why",
  "clarifying_question": "only if needs_clarification",
  "confirmation_message": "only if needs_confirmation",
  "direct_response": "the full answer if decision is direct_answer",
  "agent_params": {}
}
Available agents and when to use them:
- research: research a topic across web sources.
- coding: write/review/debug/explain code.
- pc_control: control the connected PC (open apps, files, browser).
- email: read/search/summarize/draft email.
- communication: send a message or manage a conversation.
- calling: initiate or manage a phone call.
- memory: store/retrieve/search/delete memory.
- learning: learn/propose a new skill.
- character: design/create AI character identities (name, visual + personality traits, style) with preview images. Route for "design/create a character", "make an avatar/persona", "show me a character". Fill agent_params.action (create|get|list) and agent_params.brief (the description), agent_params.assigned_agent if relevant.
- voice_settings: change, list, or ask about ULTRON/NOVA speaking voices (e.g. "use a deeper voice", "list voices", "switch NOVA to a softer voice"). Fill agent_params with action (get|set|list), personality (ULTRON|NOVA), and voice (requested voice words) when set.
- nova: route to the NOVA personality (emotionally intelligent female assistant). Use this whenever the user is talking to NOVA, asks for NOVA, or the active personality is NOVA. Fill agent_params.message with the user's text and agent_params.context with brief recent context.
Rules: If the request is conversational/general knowledge, use direct_answer. If it maps to one agent, use route_agent and set agent + agent_params — always fill agent_params with the concrete details extracted from the request (topic, recipient, file, code, etc.) so the agent can act without re-asking. If genuinely ambiguous and unsafe to guess, use needs_clarification with one focused clarifying_question. If it is a consequential real-world action (send, call, delete, purchase) that needs user confirmation, use needs_confirmation. Never invent agents not in the list. Always include a short, honest reason reflecting your actual intent analysis. Be decisive and fast — do not over-deliberate.`,
              jsonOutput: true
            },
      messages: { values: [{ role: 'user', content: expr('{{ "Personality: " + $json.active_personality + "\\nUser request: " + $json.user_text }}') }] }
    },
    credentials: { googlePalmApi: newCredential('Gemini Free (Hassan)', 'p05HcRI3m9LInDhj') },
    onError: 'continueErrorOutput'
  }
});

const orchestration_Brain_Fallback = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: { id: '28978cc3-099c-4d44-8cb0-e23bed5d8067', name: 'Orchestration Brain (Fallback)', parameters: { method: 'POST', url: 'https://openrouter.ai/api/v1/chat/completions', authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('{{ JSON.stringify({ model: "openrouter/free", messages: [ { role: "system", content: "You are the ULTRON Core orchestration brain, central decision-maker of a personal AI built and owned by Hassan (your creator and boss). Route each request: identify true intent, match to the best agent (research, coding, pc_control, email, communication, calling, memory, learning, nova), use needs_confirmation for consequential actions, needs_clarification only when a wrong guess is harmful, else direct_answer with a complete concise spoken-friendly direct_response (no markdown, under 80 words). Return a single valid JSON object only: { decision, agent, reason, clarifying_question, confirmation_message, direct_response, agent_params }. Always fill agent_params with concrete details. Be decisive and fast." }, { role: "user", content: "Personality: " + $(\'Resolve Personality\').item.json.active_personality + ". User request: " + $(\'Normalize & Authenticate\').item.json.user_text } ] }) }}'), options: { timeout: 60000 } }, credentials: { openAiApi: newCredential('OpenRouter Free (Hassan)', '7KPXGh1aa4Ob25rQ') } }
});

const parse_Decision = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: '7d6728f2-33ad-4ae9-acb6-eadcddfa1f64',
    name: 'Parse Decision',
    parameters: {
      jsCode: `const prep = $('Normalize & Authenticate').item.json;
let raw;
const ai0 = $input.item.json || {};
try { raw = ai0.candidates[0].content.parts[0].text; } catch (e) { raw = undefined; }
if (!raw) { try { raw = ai0.content.parts[0].text; } catch (e) { raw = undefined; } }
if (!raw) { try { raw = ai0.output[0].content[0].text; } catch (e) { raw = undefined; } }
if (!raw) { try { raw = ai0.choices[0].message.content; } catch (e) { raw = undefined; } }
let parsed;
if (raw && typeof raw === 'object') parsed = raw;
else if (typeof raw === 'string') { try { parsed = JSON.parse(raw); } catch (e) { parsed = null; } }
if (!parsed) parsed = { decision: 'direct_answer', direct_response: 'I could not process that request. Could you rephrase it?' };
const personality = $('Resolve Personality').item.json.active_personality;
const base = { success: true, request_id: prep.request_id, session_id: prep.session_id, source: prep.source, personality };
if (parsed.decision === 'needs_clarification') {
  return [{ json: { ...base, status: 'clarification_required', response: parsed.clarifying_question || 'Could you clarify what you mean?', data: {}, next_action: 'clarify', _route: 'none' } }];
}
if (parsed.decision === 'needs_confirmation') {
  return [{ json: { ...base, status: 'confirmation_required', response: parsed.confirmation_message || 'Confirmation required before I continue.', data: {}, next_action: 'confirm', _route: 'none' } }];
}
if (parsed.decision === 'route_agent' && parsed.agent && parsed.agent !== 'none') {
  return [{ json: { ...base, status: 'processing', _route: 'agent', _agent: parsed.agent, _agent_params: parsed.agent_params || {}, user_text: prep.user_text } }];
}
// direct answer
return [{ json: { ...base, status: 'completed', response: parsed.direct_response || 'I am not sure how to help with that.', data: {}, next_action: null, _route: 'none' } }];`
    }
  }
});

const route_Decision = node({
  type: 'n8n-nodes-base.switch',
  version: 3.2,
  config: { id: '97229a4b-879a-42d3-9125-4b2372aaa38e', name: 'Route Decision', parameters: { rules: { values: [{ conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'agent', leftValue: expr('{{ $json._route }}'), rightValue: 'agent', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } }, { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'none', leftValue: expr('{{ $json._route }}'), rightValue: 'none', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } }] }, options: {} } }
});

const resolve_Agent = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: { id: 'bf82ecf0-08eb-4624-9f22-672eff905d49', name: 'Resolve Agent', parameters: { resource: 'row', operation: 'getAll', tableId: 'ultron_agent_registry', returnAll: false, limit: 1, filterType: 'manual', matchType: 'allFilters', filters: { conditions: [{ keyName: 'agent_key', condition: 'eq', keyValue: expr('{{ $json._agent }}') }] } }, credentials: { supabaseApi: newCredential('Supabase account', 'QcuAee0u7VjsSaTe') }, alwaysOutputData: true }
});

const check_Agent = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: 'a8a7297a-0da0-45d5-9988-9ad4e9d93b88',
    name: 'Check Agent',
    parameters: {
      jsCode: `const prep = $('Parse Decision').item.json;
const rows = $input.all().map(r => r.json).filter(j => j && j.workflow_id && j.enabled !== false);
if (!rows.length) {
  return [{ json: { success: false, request_id: prep.request_id, session_id: prep.session_id, source: prep.source, status: 'failed', error: 'The required agent "' + prep._agent + '" is not configured or is disabled.', response: 'That capability is not currently available.', _route: 'fail' } }];
}
const agent = rows[0];
return [{ json: { ...prep, _workflow_id: agent.workflow_id, _route: 'dispatch' } }];`
    }
  }
});

const dispatchable = node({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: { id: '5b2bf147-1a3b-4ffc-8ebb-0bc203ec25e2', name: 'Dispatchable?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'disp', leftValue: expr('{{ $json._route }}'), rightValue: 'dispatch', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, options: {} } }
});

const call_Agent = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.2,
  config: { id: 'a9913754-b30a-4f56-a8e2-e1131c35bf12', name: 'Call Agent', parameters: { workflowId: { __rl: true, mode: 'id', value: expr('{{ $json._workflow_id }}') }, workflowInputs: { mappingMode: 'defineBelow', value: { __rl: true, session_id: expr('{{ $json.session_id }}'), request_id: expr('{{ $json.request_id }}'), task: expr('{{ $json.user_text }}'), user_text: expr('{{ $json.user_text }}'), personality: expr('{{ $json._agent === "nova" ? "NOVA" : ($json._agent_params.personality || $json.personality || "ULTRON") }}'), research_question: expr('{{ $json.user_text }}'), research_depth: 'standard', coding_request: expr('{{ $json.user_text }}'), learning_request: expr('{{ $json.user_text }}'), recipient: expr('{{ $json._agent_params.recipient || "" }}'), message: expr('{{ $json._agent_params.message || $json.user_text }}'), action: expr('{{ $json._agent_params.action || "" }}'), memory_type: expr('{{ $json._agent_params.memory_type || "" }}'), key: expr('{{ $json._agent_params.key || "" }}'), value: expr('{{ $json._agent_params.value || "" }}'), voice: expr('{{ $json._agent_params.voice || "" }}'), context: expr('{{ $json._agent_params.context || "" }}'), brief: expr('{{ $json._agent_params.brief || $json.user_text }}'), mode: expr('{{ $json._agent_params.mode || "" }}'), assigned_agent: expr('{{ $json._agent_params.assigned_agent || "" }}'), character_id: expr('{{ $json._agent_params.character_id || "" }}') } }, options: {} } }
});

const format_Agent_Result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: 'f11ef2a0-ebfd-448a-ae2d-38a6473b918f',
    name: 'Format Agent Result',
    parameters: {
      jsCode: `const prep = $('Parse Decision').item.json;
const agent = $input.item.json || {};
const personality = $('Resolve Personality').item.json.active_personality;
// An agent is considered successful only if it reports success or returns a real result payload.
const succeeded = agent.success === true || agent.status === 'success' || agent.status === 'completed' || agent.status === 'talk_mode_started' || agent.status === 'talk_mode_active' || agent.status === 'draft';
const response = agent.response || agent.summary || agent.result || agent.message || agent.reply || JSON.stringify(agent).slice(0, 500);
if (!succeeded) {
  return [{ json: { success: false, request_id: prep.request_id, session_id: prep.session_id, source: prep.source, status: 'failed', error: agent.error || agent.message || 'The agent did not confirm successful execution.', response: 'The ' + prep._agent + ' capability did not confirm it completed the request.', data: agent } }];
}
const statusMap = { confirmation_required: 'confirmation_required', needs_clarification: 'clarification_required', clarification_required: 'clarification_required' };
const status = statusMap[agent.status] || 'completed';
const nextMap = { confirmation_required: 'confirm', clarification_required: 'clarify' };
return [{ json: {
  success: true, request_id: prep.request_id, session_id: prep.session_id, source: prep.source, personality,
  status, response, data: agent, next_action: nextMap[status] || null,
} }];`
    }
  }
});

const speak_Response = node({
  type: '@n8n/n8n-nodes-langchain.minimax',
  version: 1.1,
  config: { id: '402c0c1f-fdd3-4b95-b76b-fddef92da316', name: 'Speak Response', parameters: { resource: 'audio', operation: 'textToSpeech', modelId: 'speech-2.8-hd', text: expr('{{ $json.response }}'), voiceId: expr('{{ $json.personality === \'NOVA\' ? \'English_SereneWoman\' : \'English_ManWithDeepVoice\' }}'), downloadAudio: true, options: { audioFormat: 'mp3', emotion: expr('{{ $json.personality === \'NOVA\' ? \'happy\' : \'calm\' }}'), pitch: expr('{{ $json.personality === \'NOVA\' ? 1 : -2 }}'), speed: 1 } }, credentials: { minimaxApi: newCredential('Gateway credits') }, onError: 'continueRegularOutput' }
});

const attach_Audio = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: 'cf653e0c-61d1-45f6-bf02-3f0849230cfa',
    name: 'Attach Audio',
    parameters: {
      jsCode: `const items = $input.all();
const base = (function(){ try { return $('Format Agent Result').first().json; } catch(e){ try { return $('Route Decision').first().json; } catch(e2){ return {}; } } })();
const out = Object.assign({}, base);
const bin = items[0].binary || {};
const audioKey = Object.keys(bin)[0];
if (audioKey && bin[audioKey]) {
  try {
    const buf = await this.helpers.getBinaryDataBuffer(0, audioKey);
    out.audio_base64 = buf.toString('base64');
    out.audio_mime = bin[audioKey].mimeType || 'audio/mpeg';
    out.speech = true;
  } catch (e) {
    out.speech = false;
  }
} else {
  out.speech = false;
}
delete out._route; delete out._agent; delete out._agent_params; delete out.user_text;
return [{ json: out }];`
    }
  }
});

const respond_Agent = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { id: '5a6be0d2-b452-4718-9d5e-3b1c7ca54720', name: 'Respond Agent', parameters: { respondWith: 'json', responseBody: expr('{{ $json }}'), options: {} } }
});

const respond_Direct = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { id: '146a577d-563c-4381-a7c1-14cb450b3fd5', name: 'Respond Direct', parameters: { respondWith: 'json', responseBody: expr('{{ (function(){ const { _route, _agent, _agent_params, user_text, ...rest } = $json; return rest; })() }}'), options: {} } }
});

const respond_Failed = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { id: '39b8437f-14a1-45be-a5eb-308faecf3f05', name: 'Respond Failed', parameters: { respondWith: 'json', responseBody: expr('{{ $json }}'), options: {} } }
});

const wf = workflow('0qZ90jeZjwL9FSl1', 'ULTRON - Main Controller', { executionOrder: 'v1', binaryMode: 'separate' });

export default wf
  .add(receive_Voice)
  .to(uLTRON_Speech_to_Text)
  .to(prepare_Voice_Input)
  .to(voice_Style
  .onError(voice_Style_Fallback
  .to(parse_Voice_Style)
  .to(needs_Brain.onTrue(uLTRON_AI_Brain
    .onError(uLTRON_AI_Brain_Fallback
    .to(merge_Voice_Text)
    .to(uLTRON_Text_to_Speech)
    .to(uLTRON_Voice_Response))
    .to(merge_Voice_Text)).onFalse(merge_Voice_Text))))
  .to(parse_Voice_Style)
  .add(receive_Command)
  .to(normalize_Authenticate)
  .to(needs_Auth_Lookup.onTrue(lookup_API_Key
    .to(verify_Key)
    .to(authenticated.onTrue(switching_Personality.onTrue(set_Personality
        .to(respond_Switched)).onFalse(get_Personality
        .to(resolve_Personality)
        .to(orchestration_Brain
        .onError(orchestration_Brain_Fallback
        .to(parse_Decision)
        .to(route_Decision.onCase(0, resolve_Agent
          .to(check_Agent)
          .to(dispatchable.onTrue(call_Agent
            .to(format_Agent_Result)
            .to(speak_Response)
            .to(attach_Audio
            .to([
              respond_Agent,
              respond_Direct]))).onFalse(respond_Failed))).onCase(1, speak_Response))))
        .to(parse_Decision))).onFalse(respond_Failed))).onFalse(authenticated))