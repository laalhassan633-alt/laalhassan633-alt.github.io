import { workflow, trigger, node, newCredential, expr } from '@n8n/workflow-sdk';

const called_as_Sub_workflow = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { id: 'ed8b8311-8d20-4523-83e6-5f1285de0dc0', name: 'Called as Sub-workflow', parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [{ name: 'action', type: 'string' }, { name: 'session_id', type: 'string' }, { name: 'learning_request', type: 'string' }, { name: 'source_information', type: 'string' }, { name: 'requested_by', type: 'string' }, { name: 'approved_skill', type: 'string' }] } } }
});

const normalize_Input = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: 'ea33a29c-0115-471a-a57c-fe4e7df329ed',
    name: 'Normalize Input',
    parameters: {
      jsCode: `const raw = $input.item.json;
const src = (raw && raw.body) ? raw.body : raw;
const action = (src.action || 'learn').toString().toLowerCase().trim();
const session_id = (src.session_id || 'default').toString().trim() || 'default';
function fail(m) { return [{ json: { success: false, status: 'error', error: m } }]; }
if (!['learn', 'register_approved'].includes(action)) return fail('Invalid action: ' + action);
const out = { success: true, action, session_id };
if (action === 'learn') {
  const lr = (src.learning_request || '').toString().trim();
  if (!lr) return fail('Missing learning_request.');
  out.learning_request = lr;
  out.source_information = (src.source_information || '').toString();
  out.requested_by = (src.requested_by || 'user').toString();
} else {
  let s = src.approved_skill;
  if (typeof s === 'string') { try { s = JSON.parse(s); } catch (e) { s = null; } }
  if (!s || typeof s !== 'object') return fail('register_approved requires an approved_skill object.');
  out.approved_skill = s;
}
return [{ json: out }];`
    }
  }
});

const valid = node({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: { id: '8955ed16-9a15-46bb-99a2-47175ed9fadf', name: 'Valid?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'ok', leftValue: expr('{{ $json.success }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } } }
});

const route_Action = node({
  type: 'n8n-nodes-base.switch',
  version: 3.2,
  config: { id: '974b1291-b973-4f29-8c82-f8dd2addcdf3', name: 'Route Action', parameters: { mode: 'rules', rules: { values: [{ conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'l', leftValue: expr('{{ $json.action }}'), rightValue: 'learn', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } }, { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'r', leftValue: expr('{{ $json.action }}'), rightValue: 'register_approved', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } }] }, options: {} } }
});

const analyze_Capability = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    id: 'ab100004-1555-45ed-889a-521182569c55',
    name: 'Analyze Capability',
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'list', value: 'gpt-4o-mini' },
      responses: {
              values: [
                        {
                                    role: 'system',
                                    content: `You are the capability-analysis component of the ULTRON assistant's Learning Agent. Given a learning request, produce a structured proposal for a new skill. You MUST respond with a single valid JSON object only (no markdown, no code fences), in exactly this structure:
{
  "capability_identified": "short name of the missing capability",
  "proposed_skill": {
    "skill_id": "snake_case_id",
    "name": "Human readable name",
    "description": "What the skill does",
    "category": "category",
    "parameters": { "param_name": "type" },
    "permission": "low|medium|high",
    "requires_confirmation": true,
    "enabled": false
  },
  "required_inputs": ["..."],
  "expected_outputs": ["..."],
  "external_services": ["..."],
  "required_credentials": ["..."],
  "risks": ["..."]
}
Rules: permission must be low, medium, or high. Set permission to medium or high if the skill touches external systems, files, messages, the user's PC, money, or irreversible actions. Always set requires_confirmation true for medium and high. Never invent credentials or claim a credential exists. Identify any external service/API the skill would need. Keep skill_id snake_case and specific.`
                                  },
                        { role: 'user', content: expr('{{ "Learning request: " + $json.learning_request + "\\n\\nSource information: " + $json.source_information }}') }
                      ]
            },
      simplify: true,
      options: { textFormat: { textOptions: { type: 'json_object' } } }
    },
    credentials: { openAiApi: newCredential('Gateway credits') }
  }
});

const analyze_Capability_Fallback = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Analyze Capability (Fallback)',
    parameters: {
      method: 'POST',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ model: "openrouter/free", messages: [ { role: "system", content: "You are the capability-analysis component of the ULTRON Learning Agent. Given a learning request, produce a single valid JSON object only (no markdown): { capability_identified, proposed_skill: { skill_id, name, description, category, parameters, permission: low|medium|high, requires_confirmation: true, enabled: false }, required_inputs, expected_outputs, external_services, required_credentials, risks }. Set permission medium/high if the skill touches external systems, files, messages, PC, money, or irreversible actions; requires_confirmation true for medium/high; never invent credentials; skill_id snake_case." }, { role: "user", content: "Learning request: " + $(\'Normalize Input\').item.json.learning_request + " Source information: " + $(\'Normalize Input\').item.json.source_information } ] }) }}'),
      options: { timeout: 90000, response: { response: { responseFormat: 'json' } } }
    },
    credentials: { openAiApi: newCredential('OpenRouter Free (Hassan)', '7KPXGh1aa4Ob25rQ') }
  }
});

const reshape_Analyze_Fallback = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Reshape Analyze Fallback',
    parameters: {
      jsCode: `const j = $input.item.json;
const text = (j.choices && j.choices[0] && j.choices[0].message) ? j.choices[0].message.content : '';
return [{ json: { output: [{ content: [{ text }] }] } }];`
    }
  }
});

const validate_Proposal = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: '7d783f85-6852-476d-b209-7b729ab262c3',
    name: 'Validate Proposal',
    parameters: {
      jsCode: `const prep = $('Normalize Input').item.json;
let raw;
try { raw = $json.output[0].content[0].text; } catch (e) { raw = undefined; }
let parsed;
if (raw && typeof raw === 'object') parsed = raw;
else if (typeof raw === 'string') { try { parsed = JSON.parse(raw); } catch (e) { parsed = null; } }
function fail(m) { return [{ json: { success: false, status: 'error', error: m } }]; }
if (!parsed || !parsed.proposed_skill) return fail('Could not produce a structured skill proposal.');

const s = parsed.proposed_skill;
const errors = [];
const warnings = [];
if (!s.skill_id || !/^[a-z0-9_]+$/.test(s.skill_id)) errors.push('skill_id missing or not snake_case.');
if (!s.name) errors.push('name missing.');
if (!s.description) errors.push('description missing.');
const perm = (s.permission || '').toLowerCase();
if (!['low', 'medium', 'high'].includes(perm)) errors.push('invalid permission.');
if (typeof s.parameters !== 'object' || s.parameters === null) errors.push('parameters must be an object.');
// Security: never enable, always require confirmation for med/high
s.permission = perm;
if (perm === 'high' || perm === 'medium') s.requires_confirmation = true;
if (typeof s.requires_confirmation !== 'boolean') s.requires_confirmation = true;
s.enabled = false; // never auto-enable
// Sensitive-data guard
const hay = JSON.stringify(parsed).toLowerCase();
const banned = ['api_key', 'apikey', 'password', 'secret', 'token', 'bearer', 'private_key', 'credential'];
for (const b of banned) { if (hay.includes(b)) warnings.push('Proposal text references "' + b + '" — credentials must live in n8n credential system, never in the skill.'); }
if (errors.length) return [{ json: { success: false, status: 'error', error: 'Validation failed: ' + errors.join(' ') } }];

const external = parsed.external_services || [];
const creds = parsed.required_credentials || [];
if (external.length || creds.length) warnings.push('Requires external services/credentials: ' + external.concat(creds).join(', ') + '. These must be configured manually.');

const validation = {
  passed: true,
  checks: ['required_fields', 'skill_id_format', 'parameters_object', 'permission_valid', 'confirmation_defined', 'external_dependencies_identified', 'security_scan'],
  warnings,
};
const sandbox_test = { status: 'not_available', reason: 'No real sandbox execution environment is configured.' };

return [{
  json: {
    success: true,
    status: 'proposed',
    capability_identified: parsed.capability_identified || s.name,
    proposed_skill: s,
    validation,
    sandbox_test,
    approval_required: true,
    session_id: prep.session_id,
    learning_request: prep.learning_request,
  },
}];`
    }
  }
});

const log_Proposal_to_Memory = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.2,
  config: { id: 'dfdfb23f-8660-4b71-ad45-fbccfc4248cb', name: 'Log Proposal to Memory', parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: '5QCDN6MjFRycWAWD' }, mode: 'once', workflowInputs: { mappingMode: 'defineBelow', value: { action: 'store', session_id: expr('{{ $json.session_id }}'), memory_type: 'conversation_context', key: expr('{{ "proposed_skill_" + $json.proposed_skill.skill_id }}'), value: expr('{{ "Proposed skill: " + $json.proposed_skill.name + " (permission: " + $json.proposed_skill.permission + ", status: proposed, awaiting approval)" }}') } } } }
});

const respond_Proposal = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { id: '812f0def-a720-4a70-88cf-fcc200903feb', name: 'Respond Proposal', parameters: { respondWith: 'json', responseBody: expr('{{ { "success": true, "status": "proposed", "capability_identified": $("Validate Proposal").item.json.capability_identified, "proposed_skill": $("Validate Proposal").item.json.proposed_skill, "validation": $("Validate Proposal").item.json.validation, "sandbox_test": $("Validate Proposal").item.json.sandbox_test, "approval_required": true } }}') } }
});

const validate_Approved_Skill = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: 'b767586a-4c46-4c1d-a9ca-13a96fb01d0b',
    name: 'Validate Approved Skill',
    parameters: {
      jsCode: `const prep = $('Normalize Input').item.json;
const s = prep.approved_skill;
function fail(m) { return [{ json: { success: false, status: 'error', error: m } }]; }
if (!s.skill_id || !/^[a-z0-9_]+$/.test(s.skill_id)) return fail('approved skill_id invalid.');
if (!s.name || !s.description) return fail('approved skill missing name/description.');
const perm = (s.permission || '').toLowerCase();
if (!['low','medium','high'].includes(perm)) return fail('approved skill invalid permission.');
// Enforce registry security model
s.permission = perm;
if (perm === 'high' || perm === 'medium') s.requires_confirmation = true;
s.enabled = false; // register disabled regardless
if (typeof s.parameters !== 'object' || s.parameters === null) s.parameters = {};
return [{ json: { success: true, session_id: prep.session_id, skill: s } }];`
    }
  }
});

const register_in_Skill_Registry = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.2,
  config: { id: '26324f5c-c303-460e-960a-ca7b516e122b', name: 'Register in Skill Registry', parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'L39Q2uRGr2NjIdQy' }, mode: 'once', workflowInputs: { mappingMode: 'defineBelow', value: { action: 'register', skill: expr('{{ JSON.stringify($json.skill) }}') } } } }
});

const build_Register_Result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: '6e21a026-d1b1-46d0-bca6-05cc56c65599',
    name: 'Build Register Result',
    parameters: {
      jsCode: `const reg = $input.item.json || {};
const prep = $('Validate Approved Skill').item.json;
if (reg.success === false) {
  return [{ json: { success: false, status: 'error', error: reg.error || 'Skill Registry rejected the registration.' } }];
}
return [{ json: { success: true, status: 'registered', skill_id: prep.skill.skill_id, enabled: false } }];`
    }
  }
});

const respond_Register = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { id: '0e072fd9-c011-4a7a-a7d0-c9f0cef276a3', name: 'Respond Register', parameters: { respondWith: 'json', responseBody: expr('{{ $json }}') } }
});

const respond_Error = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { id: 'ba7aa7f1-7ddf-451f-b83a-01a7e9a755ec', name: 'Respond Error', parameters: { respondWith: 'json', responseBody: expr('{{ $json }}') } }
});

const receive_Request = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2,
  config: { id: '483cf9fd-636b-4499-8037-42d436f29213', name: 'Receive Request', parameters: { httpMethod: 'POST', path: 'ultron-learning-agent', responseMode: 'responseNode', options: {} }, webhookId: '9af0ea4b-57ae-4496-ab35-060d17026322' }
});

const wf = workflow('PlaX5T3s7wj8nRmj', 'ULTRON - Learning Agent', { executionOrder: 'v1', binaryMode: 'separate', timeSavedMode: 'fixed', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false });

export default wf
  .add(called_as_Sub_workflow)
  .to(normalize_Input)
  .to(valid.onTrue(route_Action.onCase(0, analyze_Capability
      .to(validate_Proposal)
      .onError(analyze_Capability_Fallback
        .to(reshape_Analyze_Fallback)
        .to(validate_Proposal))
      .to(log_Proposal_to_Memory)
      .to(respond_Proposal)).onCase(1, validate_Approved_Skill
      .to(register_in_Skill_Registry)
      .to(build_Register_Result)
      .to(respond_Register))).onFalse(respond_Error))
  .add(receive_Request)
  .to(normalize_Input)