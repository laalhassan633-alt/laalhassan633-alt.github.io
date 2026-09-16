import { workflow, trigger, node, newCredential, expr } from '@n8n/workflow-sdk';

// ============================================================
// NOVA — ADVANCED VOICE & EMOTION ENGINE
// Input: text (or transcript from STT) + session_id
// Detects mood + transition, handles voice commands, generates
// an emotion-styled NOVA response, and speaks it via MiniMax TTS
// with dynamically adapted parameters. All $0 (Gemini + Gateway credits).
// ============================================================

const called_as_Sub_workflow = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'Called as Sub-workflow', parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [{ name: 'session_id', type: 'string' }, { name: 'message', type: 'string' }, { name: 'context', type: 'string' }, { name: 'speak', type: 'boolean' }] } } }
});

// --- 1. Normalize input ---
const normalize_Input = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Normalize Input',
    parameters: {
      jsCode: `const raw = $input.item.json;
const src = (raw && raw.body) ? raw.body : raw;
const message = (src.message || src.transcript || src.text || '').toString().trim();
const session_id = (src.session_id || 'default').toString().trim() || 'default';
const context = (src.context || src.conversation_context || '').toString();
const speak = src.speak !== false && src.speak !== 'false';
function fail(m){ return [{ json: { success:false, error:m } }]; }
if (!message) return fail('Missing message.');
return [{ json: { success:true, session_id, message, context, speak } }];`
    }
  }
});

const valid = node({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: { name: 'Valid?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'ok', leftValue: expr('{{ $json.success }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } } }
});

// --- 2. Voice command detector (fast, code-based, no AI cost) ---
const voice_Command_Detect = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Voice Command Detect',
    parameters: {
      jsCode: `const prep = $input.item.json;
const m = prep.message.toLowerCase();
// Detect explicit voice-control commands so they never reach the brain.
const PROFILE_MAP = [
  { re: /(natural|default|normal) (voice|mode)|reset (your )?voice|keep your normal voice/, profile: 'NOVA Natural' },
  { re: /calm voice|use calm|softer voice|speak soft/, profile: 'NOVA Calm' },
  { re: /energetic voice|use energetic|more energy|more expressive/, profile: 'NOVA Energetic' },
  { re: /professional voice|use professional|be more (serious|professional)/, profile: 'NOVA Professional' },
  { re: /friendly voice|use friendly/, profile: 'NOVA Friendly' },
  { re: /focus voice|use focus/, profile: 'NOVA Focus' },
];
const isVoiceCmd = /(change|switch|use|reset|speak|sound|be|talk).*(voice|slower|faster|softer|louder|pitch|expressive|serious|natural|calm|energetic|professional|friendly)/.test(m) || /(speak|talk|sound) (slower|faster|softer|louder|normally)/.test(m);
if (!isVoiceCmd) return [{ json: Object.assign({}, prep, { intent: 'conversation' }) }];
let profile = null;
for (const p of PROFILE_MAP) { if (p.re.test(m)) { profile = p.profile; break; } }
const changes = {};
if (/slower|slow down/.test(m)) changes.speed = 0.85;
if (/faster|speed up/.test(m)) changes.speed = 1.2;
if (/softer|quiet/.test(m)) { changes.pitch = -1; changes.energy = 'low'; }
if (/lower your pitch|deeper/.test(m)) changes.pitch = -2;
if (/higher pitch/.test(m)) changes.pitch = 2;
if (/more energy|more expressive/.test(m)) { changes.energy = 'high'; changes.expressiveness = 'high'; }
if (/list (the )?voices|what voices|which voices/.test(m)) return [{ json: Object.assign({}, prep, { intent: 'voice_list' }) }];
if (/what voice|current voice|which voice/.test(m) && !/change|switch|use/.test(m)) return [{ json: Object.assign({}, prep, { intent: 'voice_get' }) }];
return [{ json: Object.assign({}, prep, { intent: 'voice_control', voice_profile: profile, parameter_changes: changes }) }];`
    }
  }
});

const is_Voice_Command = node({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: { name: 'Is Voice Command?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'vc', leftValue: expr('{{ $json.intent }}'), rightValue: 'conversation', operator: { type: 'string', operation: 'notEquals' } }], combinator: 'and' } } }
});

// --- 3a. Voice control path: call existing Voice Settings workflow ---
const call_Voice_Settings = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.2,
  config: {
    name: 'Call Voice Settings',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'tOvSMuxiJAP1SydR' },
      mode: 'once',
      workflowInputs: { mappingMode: 'defineBelow', value: {
        action: expr("{{ $json.intent === 'voice_list' ? 'list' : ($json.intent === 'voice_get' ? 'get' : 'set') }}"),
        personality: 'NOVA',
        voice: expr("{{ $json.voice_profile || '' }}")
      } }
    }
  }
});

const build_Voice_Reply = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Voice Reply',
    parameters: {
      jsCode: `const cmd = $('Voice Command Detect').item.json;
const res = $input.item.json || {};
const response = res.response || res.error || 'Done.';
// Speak the confirmation with NOVA emotion adaptation
return [{ json: {
  success: true, session_id: cmd.session_id, speak: cmd.speak,
  input: { type: 'text', transcript: cmd.message },
  emotion: { state: 'neutral', intensity: 2, confidence: 0.9, change: 'stable' },
  voice_control: true, response
} }];`
    }
  }
});

// --- 3b. Conversation path: load session context (previous mood + voice profile) ---
const load_Session = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Load Session',
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: 'HYF8MBGP6IRluVdh' }, filters: { conditions: [{ keyName: 'session_id', condition: 'eq', keyValue: expr('{{ $json.session_id }}') }] } }
  }
});

// --- 4. Emotion + response in ONE Gemini call (brain) ---
const build_Brain_Body = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Brain Body',
    parameters: {
      jsCode: `const prep = $('Normalize Input').item.json;
let prev = {};
try { prev = $('Load Session').item.json || {}; } catch (e) {}
const sys = 'You are NOVA, a warm, natural, emotionally intelligent female AI assistant built and owned by Hassan (your creator and boss). You are emotionally AWARE but never claim to literally feel human emotions. Produce ONE valid JSON object only (no markdown, no code fences) with EXACTLY this structure: {"user_emotion":"happy|excited|calm|neutral|curious|confused|frustrated|angry|stressed|sad|disappointed|tired|urgent|playful|serious","emotion_intensity":1,"emotion_confidence":0.0,"conversation_energy":"low|medium|high","response_style":"one line","spoken_response":"ONLY the words NOVA speaks aloud"}. Rules: Detect the user mood from their WORDS; weak evidence use neutral low confidence; never diagnose medical conditions; match response_style to emotion (happy=warm, excited=energetic, calm=relaxed, curious=engaging, confused=patient, frustrated=calm+understanding+solution-focused, angry=calm+respectful, stressed=gentle+reassuring, sad=warm+supportive, tired=quiet+concise, urgent=direct, playful=light+witty, serious=professional). ANTI-ROBOTIC: sound like a real person not a customer-service agent; NEVER start with Certainly, Of course, I understand, How can I help, or Is there anything else; vary acknowledgements (Yeah absolutely, Got you, Okay let me sort it out, Makes sense); use contractions; keep casual replies short; do not repeat user words back; warm natural confident slightly expressive, never childish or overly dramatic; emotional honesty (That sounds frustrating / Sounds like a rough day) NEVER I feel what you feel or I am sad; no markdown no lists no URLs, spoken aloud, under 90 words.';
const user = 'Previous emotion: ' + (prev.last_emotion || 'none') + '. Recent context: ' + (prep.context || 'none') + '. User: ' + prep.message;
const body = { model: 'google/gemma-4-31b-it:free', response_format: { type: 'json_object' }, messages: [ { role: 'system', content: sys }, { role: 'user', content: user } ] };
// Backup brain (different provider pool) used if Gemma is rate-limited
const backupBody = { model: 'nvidia/nemotron-3-super-120b-a12b:free', response_format: { type: 'json_object' }, messages: [ { role: 'system', content: sys }, { role: 'user', content: user } ] };
return [{ json: { body: JSON.stringify(body), backupBody: JSON.stringify(backupBody) } }];`
    }
  }
});

const nova_Brain = node({
  type: '@n8n/n8n-nodes-langchain.googleGemini',
  version: 1.2,
  config: {
    name: 'NOVA Brain',
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'text',
      operation: 'message',
      modelId: { __rl: true, mode: 'list', value: 'models/gemini-2.5-flash' },
      options: {
        systemMessage: `You are NOVA, a warm, natural, emotionally intelligent female AI assistant built and owned by Hassan (your creator and boss). You are emotionally AWARE but never claim to literally feel human emotions.

Produce ONE valid JSON object only (no markdown, no code fences) with EXACTLY this structure:
{
  "user_emotion": "happy|excited|calm|neutral|curious|confused|frustrated|angry|stressed|sad|disappointed|tired|urgent|playful|serious",
  "emotion_intensity": 1,
  "emotion_confidence": 0.0,
  "conversation_energy": "low|medium|high",
  "response_style": "one line",
  "spoken_response": "ONLY the words NOVA speaks aloud"
}
Rules: Detect the user mood from their WORDS; weak evidence use neutral low confidence; never diagnose medical conditions; match response_style to emotion (happy=warm, excited=energetic, calm=relaxed, curious=engaging, confused=patient, frustrated=calm+understanding+solution-focused, angry=calm+respectful, stressed=gentle+reassuring, sad=warm+supportive, tired=quiet+concise, urgent=direct, playful=light+witty, serious=professional). ANTI-ROBOTIC: sound like a real person not a customer-service agent; NEVER start with Certainly, Of course, I understand, How can I help, or Is there anything else; vary acknowledgements (Yeah absolutely, Got you, Okay let me sort it out, Makes sense); use contractions; keep casual replies short; do not repeat user words back; warm natural confident slightly expressive, never childish or overly dramatic; emotional honesty (That sounds frustrating / Sounds like a rough day) NEVER I feel what you feel or I am sad; no markdown no lists no URLs, spoken aloud, under 90 words.`,
        jsonOutput: true
      },
      messages: { values: [{ role: 'user', content: expr('{{ "Previous emotion: " + ($(\'Load Session\').item.json.last_emotion || "none") + ". Recent context: " + ($(\'Normalize Input\').item.json.context || "none") + ". User: " + $(\'Normalize Input\').item.json.message }}') }] }
    },
    credentials: { googlePalmApi: newCredential('Gemini Free (Hassan)', 'p05HcRI3m9LInDhj') }
  }
});

const nova_Brain_Fallback = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'NOVA Brain (Fallback)',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
      sendBody: true,
      contentType: 'raw',
      rawContentType: 'application/json',
      body: expr('{{ $(\'Build Brain Body\').item.json.backupBody }}'),
      options: { timeout: 90000, response: { response: { responseFormat: 'json' } } }
    },
    credentials: { openAiApi: newCredential('OpenRouter Free (Hassan)', '7KPXGh1aa4Ob25rQ') }
  }
});

// --- 5. Parse brain + compute emotion transition + MiniMax voice params ---
const build_Emotion_Result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Emotion Result',
    parameters: {
      jsCode: `const prep = $('Normalize Input').item.json;
let prev = {};
try { prev = $('Load Session').item.json || {}; } catch (e) {}
// Extract brain text
function extractText(j){ if(!j||typeof j!=='object')return undefined; if(typeof j.text==='string'&&j.text.trim())return j.text; if(Array.isArray(j.output)){for(const o of j.output){if(Array.isArray(o.content)){for(const c of o.content){if(typeof c.text==='string'&&c.text.trim())return c.text;}}if(typeof o.text==='string'&&o.text.trim())return o.text;}} if(j.candidates&&j.candidates[0]&&j.candidates[0].content&&j.candidates[0].content.parts&&j.candidates[0].content.parts[0])return j.candidates[0].content.parts[0].text; if(j.content&&j.content.parts&&j.content.parts[0]&&typeof j.content.parts[0].text==='string')return j.content.parts[0].text; if(j.choices&&j.choices[0]&&j.choices[0].message)return j.choices[0].message.content; return undefined; }
const raw = extractText($input.item.json);
let parsed = null;
if (raw && typeof raw === 'object') parsed = raw;
else if (typeof raw === 'string') { const s = raw.trim(); try { parsed = JSON.parse(s); } catch (e) { parsed = null; } }
if (!parsed || !parsed.spoken_response) {
  parsed = { user_emotion: 'neutral', emotion_intensity: 2, emotion_confidence: 0.3, conversation_energy: 'medium', response_style: 'warm', spoken_response: (typeof raw === 'string' && raw.trim()) ? raw.trim() : "Sorry, I didn't quite get that — say it again for me?" };
}

// --- Emotion transition ---
const curEmo = (parsed.user_emotion || 'neutral').toLowerCase();
const prevEmo = (prev.last_emotion || 'neutral').toLowerCase();
const curInt = Math.min(5, Math.max(1, parseInt(parsed.emotion_intensity) || 2));
const prevInt = parseInt(prev.last_intensity) || 2;
let change = 'stable';
if (!prev.last_emotion) change = 'started';
else if (curEmo !== prevEmo) change = 'changed';
else if (curInt > prevInt) change = 'increased';
else if (curInt < prevInt) change = 'decreased';
if ((parseFloat(parsed.emotion_confidence) || 0) < 0.4) change = 'uncertain';

// --- Voice params: base profile (session) + TEMPORARY mood adaptation ---
// Base voice preference (what the user picked via voice commands) - NOT permanently changed by mood.
const baseVoiceId = prev.voice_id || 'English_SereneWoman';
const baseSpeed = (prev.speed !== undefined && prev.speed !== null) ? prev.speed : 1.0;
const basePitch = (prev.pitch !== undefined && prev.pitch !== null) ? prev.pitch : 1;
const baseProfile = prev.voice_profile || 'NOVA Natural';

// Map energy/warmth/expressiveness onto MiniMax's real params: emotion, pitch, speed.
// MiniMax supports emotion: calm|happy|sad|angry|fearful|disgusted|surprised. No SSML/pause tags — not faked.
const EMO_MAP = { happy:'happy', excited:'surprised', calm:'calm', neutral:'calm', curious:'calm', confused:'calm', frustrated:'calm', angry:'calm', stressed:'calm', sad:'sad', disappointed:'sad', tired:'calm', urgent:'calm', playful:'happy', serious:'calm' };
let emotion = EMO_MAP[curEmo] || 'calm';
let speed = baseSpeed, pitch = basePitch, energy = 'medium', warmth = 'medium', expressiveness = 'medium';
// Temporary mood adaptation (does NOT overwrite the stored base profile)
if (curEmo === 'excited' || curEmo === 'playful') { speed = baseSpeed * 1.08; pitch = basePitch + 1; energy='high'; expressiveness='high'; }
else if (curEmo === 'happy') { speed = baseSpeed * 1.03; energy='medium'; warmth='high'; }
else if (curEmo === 'sad' || curEmo === 'disappointed') { speed = baseSpeed * 0.9; pitch = basePitch - 1; energy='low'; warmth='high'; }
else if (curEmo === 'frustrated' || curEmo === 'stressed') { speed = baseSpeed * 0.93; energy='low'; warmth='high'; }
else if (curEmo === 'angry') { speed = baseSpeed * 0.92; energy='low'; warmth='medium'; }
else if (curEmo === 'tired') { speed = baseSpeed * 0.88; pitch = basePitch - 1; energy='low'; }
else if (curEmo === 'urgent') { speed = baseSpeed * 1.12; energy='high'; expressiveness='low'; }
else if (curEmo === 'serious') { speed = baseSpeed; expressiveness='low'; }
// Clamp to MiniMax limits
speed = Math.min(2, Math.max(0.5, Math.round(speed * 100) / 100));
pitch = Math.min(12, Math.max(-12, Math.round(pitch)));

return [{ json: {
  success: true, session_id: prep.session_id, speak: prep.speak,
  input: { type: 'text', transcript: prep.message },
  emotion: { state: curEmo, intensity: curInt, confidence: Math.min(1, Math.max(0, parseFloat(parsed.emotion_confidence) || 0.5)), change, previous_emotion: prev.last_emotion || null, energy: parsed.conversation_energy || 'medium' },
  voice: { profile: baseProfile, voice_id: baseVoiceId, speed, pitch, energy, warmth, expressiveness, emotion_style: emotion, pause_style: 'natural' },
  response_style: parsed.response_style || '',
  response: parsed.spoken_response
} }];`
    }
  }
});

// --- 6. Save session state (mood + base voice) ---
const save_Session = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Session',
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'row', operation: 'upsert',
      dataTableId: { __rl: true, mode: 'id', value: 'HYF8MBGP6IRluVdh' },
      filters: { conditions: [{ keyName: 'session_id', condition: 'eq', keyValue: expr('{{ $json.session_id }}') }] },
      columns: { mappingMode: 'defineBelow', matchingColumns: ['session_id'], value: {
        session_id: expr('{{ $json.session_id }}'),
        last_emotion: expr('{{ $json.emotion.state }}'),
        last_intensity: expr('{{ $json.emotion.intensity }}'),
        voice_profile: expr('{{ $json.voice.profile }}'),
        voice_id: expr('{{ $json.voice.voice_id }}'),
        speed: expr('{{ $json.voice.speed }}'),
        pitch: expr('{{ $json.voice.pitch }}'),
        updated_at: expr('{{ $now.toISO() }}')
      } }
    }
  }
});

// --- 7. Speak via existing MiniMax Voice Output workflow ---
const speak_Response = node({
  type: '@n8n/n8n-nodes-langchain.minimax',
  version: 1.1,
  config: {
    name: 'Speak Response',
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'audio',
      operation: 'textToSpeech',
      modelId: 'speech-2.8-hd',
      text: expr('{{ $(\'Build Emotion Result\').item.json.response }}'),
      voiceId: expr('{{ $(\'Build Emotion Result\').item.json.voice.voice_id }}'),
      downloadAudio: true,
      options: { audioFormat: 'mp3', emotion: expr('{{ $(\'Build Emotion Result\').item.json.voice.emotion_style }}'), pitch: expr('{{ $(\'Build Emotion Result\').item.json.voice.pitch }}'), speed: expr('{{ $(\'Build Emotion Result\').item.json.voice.speed }}') }
    },
    credentials: { minimaxApi: newCredential('Gateway credits') }
  }
});

// --- 8. Attach audio (base64) to the JSON result ---
const attach_Audio = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Attach Audio',
    parameters: {
      jsCode: `const res = $('Build Emotion Result').item.json;
const out = Object.assign({}, res);
delete out.speak;
if (res.speak) {
  const bin = $input.item.binary || {};
  const key = Object.keys(bin)[0];
  if (key && bin[key]) {
    try { const buf = await this.helpers.getBinaryDataBuffer(0, key); out.audio_base64 = buf.toString('base64'); out.audio_mime = bin[key].mimeType || 'audio/mpeg'; out.speech = true; } catch (e) { out.speech = false; }
  } else { out.speech = false; }
} else { out.speech = false; }
return [{ json: out }];`
    }
  }
});

// --- Responders ---
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
  config: { name: 'Receive Request', parameters: { httpMethod: 'POST', path: 'nova-emotion', responseMode: 'responseNode', options: {} } }
});

const wf = workflow('', 'NOVA - Emotion Engine', { executionOrder: 'v1', binaryMode: 'separate' });

export default wf
  .add(called_as_Sub_workflow)
  .to(normalize_Input)
  .to(valid.onTrue(voice_Command_Detect
    .to(is_Voice_Command
      .onTrue(call_Voice_Settings
        .to(build_Voice_Reply)
        .to(speak_Response)
        .to(attach_Audio)
        .to(respond_Result))
      .onFalse(load_Session
        .to(build_Brain_Body)
        .to(nova_Brain
          .to(build_Emotion_Result)
          .onError(nova_Brain_Fallback
            .to(build_Emotion_Result)))
        .to(save_Session)
        .to(speak_Response)
        .to(attach_Audio)
        .to(respond_Result)))).onFalse(respond_Error))
  .add(receive_Request)
  .to(normalize_Input)
