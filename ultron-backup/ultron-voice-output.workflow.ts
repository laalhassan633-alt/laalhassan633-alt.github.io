import { workflow, trigger, node, newCredential, expr } from '@n8n/workflow-sdk';

const called_as_Sub_workflow = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { id: '7b665032-c0cc-4fc6-b456-0661563ed53d', name: 'Called as Sub-workflow', parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [{ name: 'response', type: 'string' }, { name: 'personality', type: 'string' }] } } }
});

const normalize_Input = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: 'f374deca-ab97-4df8-9846-ced6241d43cc',
    name: 'Normalize Input',
    parameters: {
      jsCode: `// Read the original request from the trigger (the previous node is the voice-override lookup, whose output is the table row)
let src0;
try { src0 = $('Receive Request').first().json; } catch (e) { src0 = null; }
if (!src0) { try { src0 = $('Called as Sub-workflow').first().json; } catch (e) { src0 = null; } }
const item = src0 || $input.item.json;
const body = (item && item.body) ? item.body : item;
const text = (body && typeof body.response === 'string') ? body.response : '';
const personality = ((body && body.personality) || 'ULTRON').toString().toUpperCase();
// Voice map: defaults. User overrides live in the ultron_voice_settings Data Table (change via Voice Settings workflow / voice command).
const VOICE_MAP = {
  ULTRON: { voiceId: 'English_ManWithDeepVoice', emotion: 'calm', pitch: -2, speed: 1.0, openai: 'onyx' },
  NOVA:   { voiceId: 'English_SereneWoman',      emotion: 'happy', pitch: 1,  speed: 1.0, openai: 'nova' },
};
let v = VOICE_MAP[personality] || VOICE_MAP.ULTRON;
// User-set override from the ultron_voice_settings Data Table (looked up by the Get Voice Override node)
try {
  const ov = $('Get Voice Override').first().json;
  if (ov && ov.voice_id) { v = { voiceId: ov.voice_id, emotion: ov.emotion || v.emotion, pitch: (ov.pitch !== undefined && ov.pitch !== null ? ov.pitch : v.pitch), speed: (ov.speed !== undefined && ov.speed !== null ? ov.speed : v.speed), openai: v.openai }; }
} catch (e) { /* no override found - keep default */ }
return [{ json: { response: text, personality, voiceId: v.voiceId, emotion: v.emotion, pitch: v.pitch, speed: v.speed, openai_voice: v.openai } }];`
    }
  }
});

const text_to_Speech = node({
  type: '@n8n/n8n-nodes-langchain.minimax',
  version: 1.1,
  config: {
    id: 'f6015f06-68f7-46f0-b327-2ece9448eded',
    name: 'Text to Speech',
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'audio',
      operation: 'textToSpeech',
      modelId: 'speech-2.8-hd',
      text: expr('{{ $json.response }}'),
      voiceId: expr('{{ $json.voiceId }}'),
      downloadAudio: true,
      options: { audioFormat: 'mp3', emotion: expr('{{ $json.emotion }}'), pitch: expr('{{ $json.pitch }}'), speed: expr('{{ $json.speed }}') }
    },
    credentials: { minimaxApi: newCredential('Gateway credits') }
  }
});

const text_to_Speech_Fallback = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Text to Speech (Fallback)',
    parameters: { resource: 'audio', operation: 'generate', modelId: 'tts-1', input: expr('{{ $(\'Normalize Input\').item.json.response }}'), voice: expr('{{ $(\'Normalize Input\').item.json.openai_voice }}'), options: { response_format: 'mp3', binaryPropertyOutput: 'audio' } },
    credentials: { openAiApi: newCredential('Gateway credits') }
  }
});

const get_Voice_Override = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Get Voice Override',
    onError: 'continueRegularOutput',
    parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: 'dSi7KfdwlKUxXLLr' }, filters: { conditions: [{ keyName: 'personality', condition: 'eq', keyValue: expr("{{ (($input.item.json && $input.item.json.body ? $input.item.json.body.personality : $input.item.json.personality) || 'ULTRON').toString().toUpperCase() }}") }] } }
  }
});

const validate_Audio_Output = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: 'fbe647db-97af-48fa-91f3-5ce4998970f8',
    name: 'Validate Audio Output',
    parameters: {
      jsCode: `const item = $input.item;
const binary = item.binary || {};
const j = item.json || {};
// Case 1: audio already under binary.audio (OpenAI fallback)
if (binary.audio && binary.audio.data) {
  return [{ json: { success: true }, binary: { audio: binary.audio } }];
}
// Case 2: MiniMax downloads audio to binary under some property name - take the first one
const keys = Object.keys(binary);
if (keys.length && binary[keys[0]] && binary[keys[0]].data) {
  const b = binary[keys[0]];
  return [{ json: { success: true }, binary: { audio: { data: b.data, mimeType: b.mimeType || 'audio/mpeg', fileExtension: b.fileExtension || 'mp3', fileName: b.fileName || 'voice.mp3' } } }];
}
// Case 3: base64Audio in JSON
if (j.base64Audio && typeof j.base64Audio === 'string' && j.base64Audio.length > 100) {
  return [{ json: { success: true }, binary: { audio: { data: j.base64Audio, mimeType: 'audio/mpeg', fileExtension: 'mp3', fileName: 'voice.mp3' } } }];
}
return [{ json: { success: false, error: 'Text-to-Speech did not produce audio data.' } }];`
    }
  }
});

const audio_OK = node({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: { id: '69e3c14c-1878-437a-ae8f-8efe196df446', name: 'Audio OK?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'audio-ok', leftValue: expr('{{ $json.success }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } } }
});

const respond_Audio = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { id: '1e4ddfbf-49ed-430e-b0a8-0ef6ba098af5', name: 'Respond Audio', parameters: { respondWith: 'binary' } }
});

const respond_Error = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { id: '29fdfc16-d082-4a81-a356-d3c3eae26a32', name: 'Respond Error', parameters: { respondWith: 'json', responseBody: expr('{{ { "success": false, "error": $json.error } }}') } }
});

const receive_Request = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2,
  config: { id: '38774a22-02aa-4d75-a011-24caac716ac5', name: 'Receive Request', parameters: { httpMethod: 'POST', path: 'ultron-voice-output', responseMode: 'responseNode', options: {} }, webhookId: 'ce197d73-940a-46bc-b9a7-e60cba730cc6' }
});

const wf = workflow('rSWNqpfL78qb272P', 'ULTRON - Voice Output', { executionOrder: 'v1' });

export default wf
  .add(called_as_Sub_workflow)
  .to(get_Voice_Override)
  .to(normalize_Input)
  .to(text_to_Speech
    .to(validate_Audio_Output)
    .onError(text_to_Speech_Fallback
      .to(validate_Audio_Output)))
  .to(audio_OK.onTrue(respond_Audio).onFalse(respond_Error))
  .add(receive_Request)
  .to(get_Voice_Override)
  .to(normalize_Input)