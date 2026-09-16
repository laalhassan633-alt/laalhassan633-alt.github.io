import { workflow, trigger, node, newCredential, expr } from '@n8n/workflow-sdk';

// ============================================================
// ULTRON — CHARACTER MANAGER
// Orchestration: ULTRON -> Manager -> Character Brain -> Provider -> Repository
// STEP 6: versioned provider-neutral character schema
// STEP 7: persistent repository (ultron_characters table)
// STEP 8: provider abstraction (local MiniMax image provider; pluggable)
// STEP 9: Character Intelligence Brain (structured JSON, FAST/BALANCED/QUALITY)
// STEP 10: Manager validates + executes; Brain proposes.
// ============================================================

const called_as_Sub_workflow = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { name: 'Called as Sub-workflow', parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [{ name: 'action', type: 'string' }, { name: 'character_id', type: 'string' }, { name: 'name', type: 'string' }, { name: 'assigned_agent', type: 'string' }, { name: 'brief', type: 'string' }, { name: 'mode', type: 'string' }] } } }
});

// --- STEP 10: Manager validates the request ---
const normalize_Input = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Normalize & Validate',
    parameters: {
      jsCode: `const raw = $input.item.json;
const src = (raw && raw.body) ? raw.body : raw;
const action = (src.action || 'create').toString().toLowerCase().trim();
let mode = (src.mode || 'balanced').toString().toLowerCase().trim();
if (!['fast','balanced','quality'].includes(mode)) mode = 'balanced';
// STEP 11: natural-language agent mapping ("for NOVA", "my Coding Agent")
const AGENT_MAP = { nova: 'nova', ultron: 'ultron', coding: 'coding', 'coding agent': 'coding', research: 'research', 'research agent': 'research', learning: 'learning', 'learning agent': 'learning', email: 'email', communication: 'communication', 'pc agent': 'pc_control', voice: 'voice', general: 'general' };
function mapAgent(a){ const k = (a||'').toString().toLowerCase().trim(); return AGENT_MAP[k] || (k || ''); }
function fail(m){ return [{ json: { success:false, error:m } }]; }
const VALID = ['create','get','list','preview','delete','archive','batch','revise','list_by_agent'];
if (!VALID.includes(action)) return fail('Unknown action. Use create, batch, revise, get, list, list_by_agent, preview, delete, or archive.');
if ((action==='create'||action==='batch') && !(src.brief || src.name)) return fail('Provide a brief (or name) for the character.');
if (action==='revise' && !(src.character_id && (src.brief || src.revision))) return fail('Provide character_id and a revision (e.g. "more futuristic").');
if (action==='get' && !src.character_id) return fail('Provide character_id to get.');
if (action==='list_by_agent' && !src.assigned_agent) return fail('Provide assigned_agent to list characters for.');
let count = parseInt(src.count) || 1;
if (action==='batch') { count = Math.min(25, Math.max(2, count)); }
return [{ json: {
  success: true, action, mode, count,
  character_id: (src.character_id || '').toString().trim(),
  name: (src.name || '').toString().trim(),
  assigned_agent: mapAgent(src.assigned_agent),
  brief: (src.brief || src.revision || src.name || '').toString().trim(),
  with_previews: src.with_previews === true || src.with_previews === 'true'
} }];`
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
    { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'c', leftValue: expr('{{ $json.action }}'), rightValue: 'create', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } },
    { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'l', leftValue: expr('{{ $json.action }}'), rightValue: 'list', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } },
    { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'g', leftValue: expr('{{ $json.action }}'), rightValue: 'get', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } }
  ] }, options: {} } }
});

// ============================================================
// STEP 9 — CHARACTER INTELLIGENCE BRAIN (proposes the design)
// Structured JSON, agent-aware, FAST/BALANCED/QUALITY modes.
// ============================================================
const character_Brain = node({
  type: '@n8n/n8n-nodes-langchain.googleGemini',
  version: 1.2,
  config: {
    name: 'Character Brain',
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'text',
      operation: 'message',
      modelId: { __rl: true, mode: 'list', value: 'models/gemini-2.5-flash' },
      options: {
        systemMessage: `You are the ULTRON Character Intelligence Brain. Given a character brief, design a structured character identity as ONE valid JSON object only (no markdown, no code fences), with EXACTLY this structure:
{
  "name": "character name",
  "assigned_agent": "which ULTRON agent this character serves (e.g. coding, research, nova, communication, voice, general)",
  "visual_traits": "detailed visual description for an image generator: appearance, colors, setting, lighting, style, framing",
  "personality_traits": "2-4 sentence personality: how this character thinks and speaks",
  "style": "visual art style (e.g. futuristic holographic, minimalist cyberpunk, warm realistic)",
  "design_tags": ["tag1","tag2","tag3"],
  "preview_prompt": "a single polished image-generation prompt combining the visual traits and style, ready to feed an image model"
}
Rules:
- Infer a sensible assigned_agent from the brief if not given.
- visual_traits must be concrete and image-ready (no vague words like "nice" or "cool").
- preview_prompt must be self-contained and directly usable by an image generator.
- Match the requested depth mode: FAST = brief/core fields, BALANCED = full detail, QUALITY = richer, more refined descriptions.
- Never invent capabilities; this is a visual + personality design only.`,
        jsonOutput: true
      },
      messages: { values: [{ role: 'user', content: expr('{{ "Mode: " + $json.mode.toUpperCase() + "\\nAssigned agent (if specified): " + ($json.assigned_agent || "auto") + "\\nCharacter brief: " + $json.brief }}') }] }
    },
    credentials: { googlePalmApi: newCredential('Gemini Free (Hassan)', 'p05HcRI3m9LInDhj') }
  }
});

// --- Manager parses + validates the Brain's design ---
const build_Design = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build & Validate Design',
    parameters: {
      jsCode: `const prep = $('Normalize & Validate').item.json;
function extractText(j){ if(!j||typeof j!=='object')return undefined; if(typeof j.text==='string'&&j.text.trim())return j.text; if(j.content&&j.content.parts&&j.content.parts[0]&&typeof j.content.parts[0].text==='string')return j.content.parts[0].text; if(j.candidates&&j.candidates[0]&&j.candidates[0].content&&j.candidates[0].content.parts&&j.candidates[0].content.parts[0])return j.candidates[0].content.parts[0].text; return undefined; }
const raw = extractText($input.item.json);
let d = null;
if (raw && typeof raw === 'object') d = raw;
else if (typeof raw === 'string') { try { d = JSON.parse(raw.trim()); } catch(e){ d = null; } }
function fail(m){ return [{ json: { success:false, error:m } }]; }
if (!d || !d.name || !d.preview_prompt) return fail('Character Brain did not produce a valid design.');
// STEP 6: versioned provider-neutral schema
const character_id = 'char_' + Date.now().toString(36);
const design = {
  character_id,
  name: d.name,
  assigned_agent: prep.assigned_agent || d.assigned_agent || 'general',
  visual_traits: d.visual_traits || '',
  personality_traits: d.personality_traits || '',
  style: d.style || 'futuristic holographic',
  design_tags: Array.isArray(d.design_tags) ? JSON.stringify(d.design_tags) : (d.design_tags || ''),
  provider: 'minimax',
  source: 'character-brain',
  version: 1,
  status: 'draft',
  preview_prompt: d.preview_prompt,
  mode: prep.mode
};
return [{ json: { success: true, design } }];`
    }
  }
});

// ============================================================
// STEP 8 — PROVIDER ABSTRACTION (pluggable image provider)
// First provider: local MiniMax (free via Gateway credits).
// Future providers plug in here without changing the Manager.
// ============================================================
const generate_Preview = node({
  type: '@n8n/n8n-nodes-langchain.minimax',
  version: 1.1,
  config: {
    name: 'Provider: Generate Preview',
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'image',
      operation: 'generate',
      modelId: 'image-01',
      prompt: expr('{{ $json.design.preview_prompt }}'),
      aspectRatio: '1:1',
      numberOfImages: 1,
      downloadImage: false
    },
    credentials: { minimaxApi: newCredential('Gateway credits') }
  }
});

// ============================================================
// STEP 7 — REPOSITORY: persist character + version + preview
// ============================================================
const save_Character = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Character',
    parameters: {
      resource: 'row', operation: 'insert',
      dataTableId: { __rl: true, mode: 'id', value: '1Kny3fUfyJtrpclc' },
      columns: { mappingMode: 'defineBelow', value: {
        character_id: expr("{{ $('Build & Validate Design').item.json.design.character_id }}"),
        name: expr("{{ $('Build & Validate Design').item.json.design.name }}"),
        assigned_agent: expr("{{ $('Build & Validate Design').item.json.design.assigned_agent }}"),
        visual_traits: expr("{{ $('Build & Validate Design').item.json.design.visual_traits }}"),
        personality_traits: expr("{{ $('Build & Validate Design').item.json.design.personality_traits }}"),
        style: expr("{{ $('Build & Validate Design').item.json.design.style }}"),
        design_tags: expr("{{ $('Build & Validate Design').item.json.design.design_tags }}"),
        provider: expr("{{ $('Build & Validate Design').item.json.design.provider }}"),
        source: expr("{{ $('Build & Validate Design').item.json.design.source }}"),
        version: 1,
        status: expr("{{ $json.imageUrl ? 'active' : 'draft' }}"),
        preview_url: expr('{{ $json.imageUrl || "" }}'),
        preview_prompt: expr("{{ $('Build & Validate Design').item.json.design.preview_prompt }}"),
        metadata: expr("{{ JSON.stringify({ mode: $('Build & Validate Design').item.json.design.mode }) }}"),
        created_at: expr('{{ $now.toISO() }}'),
        updated_at: expr('{{ $now.toISO() }}')
      } }
    }
  }
});

const build_Create_Result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Create Result',
    parameters: {
      jsCode: `const d = $('Build & Validate Design').item.json.design;
const prev = $input.item.json || {};
const hasImg = !!($('Provider: Generate Preview') && $('Provider: Generate Preview').item && $('Provider: Generate Preview').item.json && $('Provider: Generate Preview').item.json.imageUrl);
return [{ json: {
  success: true,
  character: d,
  preview_url: (function(){ try { return $('Provider: Generate Preview').item.json.imageUrl || null; } catch(e){ return null; } })(),
  message: 'Character "' + d.name + '" created' + (hasImg ? ' with preview image.' : ' (preview generation skipped/failed).')
} }];`
    }
  }
});

// --- GET / LIST ---
const get_Character = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Get Character', parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: '1Kny3fUfyJtrpclc' }, filters: { conditions: [{ keyName: 'character_id', condition: 'eq', keyValue: expr('{{ $json.character_id }}') }] } } }
});

const list_Characters = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'List Characters', parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: '1Kny3fUfyJtrpclc' } } }
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
  config: { name: 'Receive Request', parameters: { httpMethod: 'POST', path: 'ultron-characters', responseMode: 'responseNode', options: {} } }
});

const wf = workflow('', 'ULTRON - Character Manager', { executionOrder: 'v1' });

export default wf
  .group('Design character', [character_Brain, build_Design, generate_Preview, save_Character, build_Create_Result], { description: 'Character Brain proposes a structured design; provider generates a preview; saved to the repository.' })
  .add(called_as_Sub_workflow)
  .to(normalize_Input)
  .to(valid.onTrue(route_Action
    .onCase(0, character_Brain.to(build_Design).to(generate_Preview).to(save_Character).to(build_Create_Result).to(respond_Result))
    .onCase(1, list_Characters.to(respond_Result))
    .onCase(2, get_Character.to(respond_Result))).onFalse(respond_Error))
  .add(receive_Request)
  .to(normalize_Input)
