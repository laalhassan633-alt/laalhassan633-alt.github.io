import { workflow, trigger, node, newCredential, expr } from '@n8n/workflow-sdk';

const called_as_Sub_workflow = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'Called as Sub-workflow', parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [{ name: 'action', type: 'string' }, { name: 'personality', type: 'string' }, { name: 'voice', type: 'string' }] } } }
});

const normalize_Input = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Normalize Input',
    parameters: {
      jsCode: `const raw = $input.item.json;
const src = (raw && raw.body) ? raw.body : raw;
const action = (src.action || 'get').toString().toLowerCase().trim();
const personality = (src.personality || 'ULTRON').toString().toUpperCase().trim();
const voice = (src.voice || '').toString().trim();
function fail(m) { return [{ json: { success: false, error: m } }]; }
if (!['get','set','list'].includes(action)) return fail('Unknown action. Use get, set, or list.');
if (action === 'set' && !voice) return fail('Missing voice name for set action.');
if (!['ULTRON','NOVA'].includes(personality)) return fail('Personality must be ULTRON or NOVA.');
return [{ json: { success: true, action, personality, voice } }];`
    }
  }
});

const valid = node({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: { name: 'Valid?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'ok', leftValue: expr('{{ $json.success }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } } }
});

const route_Action = node({
  type: 'n8n-nodes-base.switch',
  version: 3.2,
  config: { name: 'Route Action', parameters: { rules: { values: [
    { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'g', leftValue: expr('{{ $json.action }}'), rightValue: 'get', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } },
    { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 's', leftValue: expr('{{ $json.action }}'), rightValue: 'set', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } },
    { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'l', leftValue: expr('{{ $json.action }}'), rightValue: 'list', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } }
  ] }, options: {} } }
});

// --- GET ---
const get_Voice = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Get Voice', parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: 'dSi7KfdwlKUxXLLr' }, filters: { conditions: [{ keyName: 'personality', condition: 'eq', keyValue: expr('{{ $json.personality }}') }] } } }
});

const build_Get_Result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Get Result',
    parameters: {
      jsCode: `const prep = $('Normalize Input').item.json;
const rows = $input.all().map(i => i.json).filter(j => j && j.voice_id);
if (!rows.length) return [{ json: { success: false, error: 'No voice configured for ' + prep.personality + '.' } }];
const r = rows[0];
return [{ json: { success: true, personality: prep.personality, voice_id: r.voice_id, voice_label: r.voice_label, emotion: r.emotion, pitch: r.pitch, speed: r.speed, response: prep.personality + ' is currently using the ' + (r.voice_label || r.voice_id) + ' voice.' } }];`
    }
  }
});

// --- SET ---
const resolve_Voice = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Resolve Voice',
    parameters: {
      jsCode: `const prep = $('Normalize Input').item.json;
// Voice catalog: voiceId -> label. Aliases map what the user might say.
const CATALOG = {
  // Male
  'English_ManWithDeepVoice': 'Man With Deep Voice',
  'English_magnetic_voiced_man': 'Magnetic-voiced Male',
  'English_Deep-VoicedGentleman': 'Deep-voiced Gentleman',
  'English_Trustworth_Man': 'Trustworthy Man',
  'English_Gentle-voiced_man': 'Gentle-voiced Man',
  'English_Diligent_Man': 'Diligent Man',
  'English_Steadymentor': 'Reliable Mentor',
  'English_PatientMan': 'Patient Man',
  'English_BossyLeader': 'Bossy Leader',
  'English_Jovialman': 'Jovial Man',
  'English_Aussie_Bloke': 'Aussie Bloke',
  'English_expressive_narrator': 'Expressive Narrator',
  // Female
  'English_SereneWoman': 'Serene Woman',
  'English_Graceful_Lady': 'Graceful Lady',
  'English_CalmWoman': 'Calm Woman',
  'English_radiant_girl': 'Radiant Girl',
  'English_compelling_lady1': 'Compelling Lady',
  'English_captivating_female1': 'Captivating Female',
  'English_Upbeat_Woman': 'Upbeat Woman',
  'English_ConfidentWoman': 'Confident Woman',
  'English_Wiselady': 'Wise Lady',
  'English_Soft-spokenGirl': 'Soft-Spoken Girl',
  'English_Whispering_girl': 'Whispering Girl',
  'English_LovelyGirl': 'Lovely Girl'
};
const ALIASES = [
  { match: ['deep', 'deeper', 'deepest', 'bass'], id: 'English_ManWithDeepVoice' },
  { match: ['magnetic'], id: 'English_magnetic_voiced_man' },
  { match: ['gentleman'], id: 'English_Deep-VoicedGentleman' },
  { match: ['trust'], id: 'English_Trustworth_Man' },
  { match: ['gentle'], id: 'English_Gentle-voiced_man' },
  { match: ['diligent'], id: 'English_Diligent_Man' },
  { match: ['mentor', 'reliable'], id: 'English_Steadymentor' },
  { match: ['patient'], id: 'English_PatientMan' },
  { match: ['bossy', 'boss', 'leader'], id: 'English_BossyLeader' },
  { match: ['jovial', 'happy man', 'cheerful man'], id: 'English_Jovialman' },
  { match: ['aussie', 'australian'], id: 'English_Aussie_Bloke' },
  { match: ['narrator'], id: 'English_expressive_narrator' },
  { match: ['serene', 'calm female', 'peaceful'], id: 'English_SereneWoman' },
  { match: ['graceful', 'elegant'], id: 'English_Graceful_Lady' },
  { match: ['calm woman'], id: 'English_CalmWoman' },
  { match: ['radiant'], id: 'English_radiant_girl' },
  { match: ['compelling'], id: 'English_compelling_lady1' },
  { match: ['captivating'], id: 'English_captivating_female1' },
  { match: ['upbeat', 'energetic'], id: 'English_Upbeat_Woman' },
  { match: ['confident'], id: 'English_ConfidentWoman' },
  { match: ['wise'], id: 'English_Wiselady' },
  { match: ['soft', 'softer', 'soft-spoken', 'softspoken'], id: 'English_Soft-spokenGirl' },
  { match: ['whisper', 'whispering', 'quiet'], id: 'English_Whispering_girl' },
  { match: ['lovely'], id: 'English_LovelyGirl' }
];
const req = prep.voice.toLowerCase();
let id = null;
// Exact voiceId match first
for (const key of Object.keys(CATALOG)) { if (key.toLowerCase() === req) { id = key; break; } }
// Alias match
if (!id) { for (const a of ALIASES) { if (a.match.some(m => req.includes(m))) { id = a.id; break; } } }
// Label match
if (!id) { for (const [key, label] of Object.entries(CATALOG)) { if (label.toLowerCase() === req || label.toLowerCase().includes(req)) { id = key; break; } } }
if (!id) return [{ json: { success: false, error: 'Unknown voice "' + prep.voice + '". Say "list voices" to hear the options.' } }];
return [{ json: { success: true, action: 'set', personality: prep.personality, voice_id: id, voice_label: CATALOG[id] } }];`
    }
  }
});

const save_Voice = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Save Voice', parameters: { resource: 'row', operation: 'upsert', dataTableId: { __rl: true, mode: 'id', value: 'dSi7KfdwlKUxXLLr' }, filters: { conditions: [{ keyName: 'personality', condition: 'eq', keyValue: expr('{{ $json.personality }}') }] }, columns: { mappingMode: 'defineBelow', matchingColumns: ['personality'], value: { personality: expr('{{ $json.personality }}'), voice_id: expr('{{ $json.voice_id }}'), voice_label: expr('{{ $json.voice_label }}'), emotion: expr("{{ $json.personality === 'NOVA' ? 'happy' : 'calm' }}"), pitch: expr("{{ $json.personality === 'NOVA' ? 1 : -2 }}"), speed: 1, updated_at: expr('{{ $now.toISO() }}') } } } }
});

const build_Set_Result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Set Result',
    parameters: {
      jsCode: `const prep = $('Resolve Voice').item.json;
return [{ json: { success: true, personality: prep.personality, voice_id: prep.voice_id, voice_label: prep.voice_label, response: 'Done. ' + prep.personality + ' will now speak with the ' + prep.voice_label + ' voice.' } }];`
    }
  }
});

// --- LIST ---
const build_List = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build List',
    parameters: {
      jsCode: `const male = ['Man With Deep Voice (deep)', 'Magnetic-voiced Male', 'Deep-voiced Gentleman', 'Trustworthy Man', 'Gentle-voiced Man', 'Diligent Man', 'Reliable Mentor', 'Patient Man', 'Bossy Leader', 'Jovial Man', 'Aussie Bloke', 'Expressive Narrator'];
const female = ['Serene Woman', 'Graceful Lady', 'Calm Woman', 'Radiant Girl', 'Compelling Lady', 'Captivating Female', 'Upbeat Woman', 'Confident Woman', 'Wise Lady', 'Soft-Spoken Girl (softer)', 'Whispering Girl (quieter)', 'Lovely Girl'];
return [{ json: { success: true, male_voices: male, female_voices: female, response: 'Available male voices: ' + male.join(', ') + '. Female voices: ' + female.join(', ') + '. Tell me which one, like: switch ULTRON to the gentle voice.' } }];`
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
  config: { name: 'Receive Request', parameters: { httpMethod: 'POST', path: 'ultron-voice-settings', responseMode: 'responseNode', options: {} } }
});

const wf = workflow('', 'ULTRON - Voice Settings', { executionOrder: 'v1' });

export default wf
  .add(called_as_Sub_workflow)
  .to(normalize_Input)
  .to(valid.onTrue(route_Action
    .onCase(0, get_Voice.to(build_Get_Result).to(respond_Result))
    .onCase(1, resolve_Voice.to(save_Voice).to(build_Set_Result).to(respond_Result))
    .onCase(2, build_List.to(respond_Result))).onFalse(respond_Error))
  .add(receive_Request)
  .to(normalize_Input)
