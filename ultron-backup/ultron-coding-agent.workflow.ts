import { workflow, trigger, node, newCredential, expr } from '@n8n/workflow-sdk';

const called_as_Sub_workflow = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { id: '284a2f17-4bb4-4bf0-81f3-d48b9c87443c', name: 'Called as Sub-workflow', parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [{ name: 'session_id', type: 'string' }, { name: 'coding_request', type: 'string' }, { name: 'language', type: 'string' }, { name: 'framework', type: 'string' }, { name: 'existing_code', type: 'string' }, { name: 'requested_by', type: 'string' }] } } }
});

const normalize_Input = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: '9b5c2781-ffb3-4d31-967b-e4f869b7da40',
    name: 'Normalize Input',
    parameters: {
      jsCode: `const raw = $input.item.json;
const src = (raw && raw.body) ? raw.body : raw;
const session_id = (src.session_id || 'default').toString().trim() || 'default';
const req = (src.coding_request || '').toString().trim();
function fail(m) { return [{ json: { success: false, error: m } }]; }
if (!req) return fail('Missing coding_request.');
return [{
  json: {
    success: true,
    session_id,
    coding_request: req,
    language: (src.language || '').toString(),
    framework: (src.framework || '').toString(),
    existing_code: (src.existing_code || '').toString(),
    requested_by: (src.requested_by || 'user').toString(),
  },
}];`
    }
  }
});

const valid = node({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: { id: '67bad5b8-5f49-4d52-af77-bfbff5f2eb46', name: 'Valid?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'ok', leftValue: expr('{{ $json.success }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } } }
});

const generate_Code = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    id: 'd7565206-c654-4d62-be8a-4f3c02a3c9df',
    name: 'Generate Code',
    onError: 'continueErrorOutput',
    parameters: {
      method: 'POST',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ model: "cohere/north-mini-code:free", messages: [ { role: "system", content: "You are the ULTRON Coding Agent. Given a programming request, produce a single valid JSON object only (no markdown, no code fences) in exactly this structure: { request_understanding, needs_clarification, questions, plan, language, code, review, errors_found, dependencies, explanation }. Rules: if requirements are ambiguous set needs_clarification true with questions and leave code empty; write clean working code; list external dependencies; never include secrets; review your own code." }, { role: "user", content: "Coding request: " + $json.coding_request + "\nLanguage: " + ($json.language || "not specified") + "\nFramework: " + ($json.framework || "none") + "\nExisting code: " + ($json.existing_code || "none") } ] }) }}'),
      options: { timeout: 120000 }
    },
    credentials: { openAiApi: newCredential('OpenRouter Free (Hassan)', '7KPXGh1aa4Ob25rQ') }
  }
});

const generate_Code_Qwen = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Generate Code (Gemma 4)',
    onError: 'continueErrorOutput',
    parameters: {
      method: 'POST',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ model: "google/gemma-4-31b-it:free", messages: [ { role: "system", content: "You are the ULTRON Coding Agent. Given a programming request, produce a single valid JSON object only (no markdown, no code fences) in exactly this structure: { request_understanding, needs_clarification, questions, plan, language, code, review, errors_found, dependencies, explanation }. Rules: if requirements are ambiguous set needs_clarification true with questions and leave code empty; write clean working code; list external dependencies; never include secrets; review your own code." }, { role: "user", content: "Coding request: " + $json.coding_request + "\nLanguage: " + ($json.language || "not specified") + "\nFramework: " + ($json.framework || "none") + "\nExisting code: " + ($json.existing_code || "none") } ] }) }}'),
      options: { timeout: 120000 }
    },
    credentials: { openAiApi: newCredential('OpenRouter Free (Hassan)', '7KPXGh1aa4Ob25rQ') }
  }
});



const build_Result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: '25c5d94e-d251-4a5e-9958-795a76d1bdd2',
    name: 'Build Result',
    parameters: {
      jsCode: `const prep = $('Normalize Input').item.json;
function extractRaw(j) {
  if (!j || typeof j !== 'object') return null;
  const ch = j.choices;
  if (Array.isArray(ch) && ch.length && ch[0] && ch[0].message) return ch[0].message.content;
  if (typeof j.text === 'string') return j.text;
  return null;
}
function fail(m) { return [{ json: { success: false, error: m } }]; }
let parsed = null;
for (const it of $input.all()) {
  const raw = extractRaw(it.json);
  if (typeof raw === 'string') { try { parsed = JSON.parse(raw); } catch (e) { parsed = null; } }
  else if (raw && typeof raw === 'object') parsed = raw;
  if (parsed) break;
}
if (!parsed) return fail('Could not generate a structured coding response.');

// Clarification path
if (parsed.needs_clarification === true) {
  return [{ json: { success: true, needs_clarification: true, questions: Array.isArray(parsed.questions) ? parsed.questions : [] } }];
}

// Sensitive-data guard on generated code
const codeStr = (parsed.code || '').toString();
const hay = codeStr.toLowerCase();
const banned = ['api_key', 'apikey', 'password', 'secret=', 'token=', 'bearer ', 'private_key'];
const leaked = banned.filter(b => hay.includes(b));

const test = { status: 'not_available', reason: 'No authorized code execution environment is configured.' };

const result = {
  success: true,
  request: prep.coding_request,
  language: parsed.language || prep.language || 'unknown',
  plan: Array.isArray(parsed.plan) ? parsed.plan : [],
  code: codeStr,
  review: parsed.review || '',
  errors_found: Array.isArray(parsed.errors_found) ? parsed.errors_found : [],
  test,
  explanation: parsed.explanation || '',
};
if (Array.isArray(parsed.dependencies) && parsed.dependencies.length) result.dependencies = parsed.dependencies;
if (leaked.length) result.security_warning = 'Generated code references potentially sensitive terms: ' + leaked.join(', ') + '. Store credentials in n8n, never in code.';
return [{ json: result }];`
    }
  }
});

const respond_Result = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { id: 'a1e98e40-256e-4d6e-88b0-23c740a61b8a', name: 'Respond Result', parameters: { respondWith: 'json', responseBody: expr('{{ $json }}') } }
});

const coding_All_Failed = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'All Models Failed',
    parameters: {
      assignments: { assignments: [ { id: 'fail-1', name: 'success', type: 'boolean', value: false }, { id: 'fail-2', name: 'error', type: 'string', value: 'All coding models failed (Cohere, Gemma). Please try again shortly.' } ] },
      options: {}
    }
  }
});

const respond_Error = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { id: '6284807d-2beb-40d6-89fb-8e05ade241f1', name: 'Respond Error', parameters: { respondWith: 'json', responseBody: expr('{{ $json }}') } }
});

const receive_Request = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2,
  config: { id: 'f6ff82f0-70a4-46a5-9602-da4ae2063eb6', name: 'Receive Request', parameters: { httpMethod: 'POST', path: 'ultron-coding', responseMode: 'responseNode', options: {} }, webhookId: 'e563276d-4fdf-43ee-9afd-6c2b2a33c0ed' }
});

const wf = workflow('Ov2bL4IXqArFZRLP', 'ULTRON - Coding Agent', { executionOrder: 'v1' });

export default wf
  .add(called_as_Sub_workflow)
  .to(normalize_Input)
  .to(valid.onTrue(generate_Code
    .to(build_Result)
    .to(respond_Result)
    .onError(generate_Code_Qwen
      .to(build_Result)
      .onError(coding_All_Failed))).onFalse(respond_Error))
  .add(coding_All_Failed)
  .to(respond_Error)
  .add(receive_Request)
  .to(normalize_Input)