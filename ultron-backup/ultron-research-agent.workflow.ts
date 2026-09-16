import { workflow, trigger, node, newCredential, expr } from '@n8n/workflow-sdk';

const called_as_Sub_workflow = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: { id: 'c09cf31d-28e1-41ca-a754-966c87de1224', name: 'Called as Sub-workflow', parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [{ name: 'session_id', type: 'string' }, { name: 'research_question', type: 'string' }, { name: 'research_depth', type: 'string' }, { name: 'requested_by', type: 'string' }] } } }
});

const normalize_Input = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: 'fd43b816-12bc-4427-90b7-a65b51a534c8',
    name: 'Normalize Input',
    parameters: {
      jsCode: `const raw = $input.item.json;
const src = (raw && raw.body) ? raw.body : raw;
const session_id = (src.session_id || 'default').toString().trim() || 'default';
const q = (src.research_question || '').toString().trim();
function fail(m) { return [{ json: { success: false, error: m, sources: [] } }]; }
if (!q) return fail('Missing research_question.');
let depth = (src.research_depth || 'standard').toString().toLowerCase().trim();
if (!['standard', 'deep'].includes(depth)) depth = 'standard';
return [{ json: { success: true, session_id, research_question: q, research_depth: depth, requested_by: (src.requested_by || 'user').toString() } }];`
    }
  }
});

const valid = node({
  type: 'n8n-nodes-base.if',
  version: 2.2,
  config: { id: '86266a90-89d8-4826-9b8e-247f93bc1d73', name: 'Valid?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'ok', leftValue: expr('{{ $json.success }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } } }
});

const generate_Search_Queries = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    id: 'fa54dada-5b48-469e-878d-424194fcd685',
    name: 'Generate Search Queries',
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'list', value: 'gpt-4o-mini' },
      responses: {
              values: [
                        {
                                    role: 'system',
                                    content: `You generate web search queries for a research agent. Given a research question and depth, produce a JSON object only (no markdown, no code fences):
{
  "goal": "one-sentence restatement of the research goal",
  "queries": ["query1", "query2", "query3"]
}
Rules: For depth "standard" produce 2-3 distinct, complementary search queries that together cover the topic from authoritative angles. For depth "deep" produce 4-5 queries covering more angles and comparisons. Queries must be plain search strings, no quotes needed.`
                                  },
                        { role: 'user', content: expr('{{ "Research question: " + $json.research_question + "\\nDepth: " + $json.research_depth }}') }
                      ]
            },
      simplify: true,
      options: { textFormat: { textOptions: { type: 'json_object' } } }
    },
    credentials: { openAiApi: newCredential('Gateway credits') }
  }
});

const generate_Search_Queries_Fallback = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Generate Search Queries (Fallback)',
    parameters: {
      method: 'POST',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ model: "openrouter/free", messages: [ { role: "system", content: "You generate web search queries for a research agent. Given a research question and depth, produce a JSON object only (no markdown): { goal, queries: [...] }. For depth standard produce 2-3 distinct complementary queries; for deep produce 4-5 covering more angles. Plain search strings." }, { role: "user", content: "Research question: " + $(\'Normalize Input\').item.json.research_question + " Depth: " + $(\'Normalize Input\').item.json.research_depth } ] }) }}'),
      options: { timeout: 60000, response: { response: { responseFormat: 'json' } } }
    },
    credentials: { openAiApi: newCredential('OpenRouter Free (Hassan)', '7KPXGh1aa4Ob25rQ') }
  }
});

const reshape_Search_Fallback = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Reshape Search Fallback',
    parameters: {
      jsCode: `const j = $input.item.json;
const text = (j.choices && j.choices[0] && j.choices[0].message) ? j.choices[0].message.content : '';
return [{ json: { output: [{ content: [{ text }] }] } }];`
    }
  }
});

const expand_Queries = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: '2fb502e1-2182-49b8-bfc5-0701dda8db55',
    name: 'Expand Queries',
    parameters: {
      jsCode: `const prep = $('Normalize Input').item.json;
let raw;
try { raw = $input.item.json.output[0].content[0].text; } catch (e) { raw = undefined; }
let parsed;
if (raw && typeof raw === 'object') parsed = raw;
else if (typeof raw === 'string') { try { parsed = JSON.parse(raw); } catch (e) { parsed = null; } }
let queries = parsed && Array.isArray(parsed.queries) && parsed.queries.length ? parsed.queries : [prep.research_question];
const goal = parsed && parsed.goal ? parsed.goal : prep.research_question;
const max = prep.research_depth === 'deep' ? 5 : 3;
queries = queries.slice(0, max);
return queries.map(q => ({ json: { query: q.toString(), goal, research_question: prep.research_question, session_id: prep.session_id, research_depth: prep.research_depth } }));`
    }
  }
});

const brave_Web_Search = node({
  type: '@brave/n8n-nodes-brave-search.braveSearch',
  version: 1.1,
  config: { id: '0aceac05-f184-471c-8078-391ab7f99d24', name: 'Brave Web Search', parameters: { operation: 'web', query: expr('{{ $json.query }}'), count: 5, additionalParameters: {} }, credentials: { braveSearchApi: newCredential('Gateway credits') } }
});

const collect_Results = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: 'd54497c6-ba2d-43dc-afc9-a7e707979d14',
    name: 'Collect Results',
    parameters: {
      jsCode: `const prep = $('Normalize Input').item.json;
const queriesUsed = $('Expand Queries').all().map(i => i.json.query);
const items = $input.all();
const sources = [];
const snippets = [];
for (const it of items) {
  const j = it.json;
  // Brave web results shape: { web: { results: [...] } } or results array
  let results = [];
  if (j.web && Array.isArray(j.web.results)) results = j.web.results;
  else if (Array.isArray(j.results)) results = j.results;
  else if (Array.isArray(j)) results = j;
  for (const r of results) {
    const title = r.title || r.name || '';
    const url = r.url || r.link || '';
    const desc = r.description || r.snippet || r.desc || '';
    if (url) {
      sources.push({ title, url, source_type: 'web', relevance: 'medium', description: desc });
      if (desc) snippets.push(desc);
    }
  }
}
// Dedup sources by URL
const seen = new Set();
const dedupSources = [];
for (const s of sources) { if (!seen.has(s.url)) { seen.add(s.url); dedupSources.push(s); } }
const combinedText = snippets.join('\\n\\n').slice(0, 12000);
return [{ json: { goal: queriesUsed.length ? ($('Expand Queries').item.json.goal || prep.research_question) : prep.research_question, research_question: prep.research_question, session_id: prep.session_id, research_depth: prep.research_depth, searches_performed: queriesUsed, sources: dedupSources, evidence_text: combinedText } }];`
    }
  }
});

const synthesize_Findings = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    id: 'e4f0c265-3877-4b3d-ab13-915a8ae7ecec',
    name: 'Synthesize Findings',
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'list', value: 'gpt-4o-mini' },
      responses: {
              values: [
                        {
                                    role: 'system',
                                    content: `You are the synthesis component of the ULTRON Research Agent. You are given a research goal and a set of web search results (titles, URLs, snippets). Produce a single valid JSON object only (no markdown, no code fences) in exactly this structure:
{
  "summary": "2-4 sentence neutral summary",
  "findings": ["key finding 1", "key finding 2"],
  "facts": ["verifiable fact stated in sources"],
  "conclusions": ["analysis/inference drawn from the facts, clearly reasoned"],
  "uncertainties": ["conflicts between sources, gaps, or low-confidence areas"],
  "sources": [{"title": "", "url": "", "source_type": "web", "relevance": "high|medium|low"}]
}
Rules: Only cite sources actually present in the provided results. Never invent or fabricate URLs, titles, or sources. Clearly separate verifiable facts from your own conclusions/analysis. If sources conflict, put the conflict in uncertainties rather than choosing one. Do not present a conclusion as an established fact.`
                                  },
                        { role: 'user', content: expr('{{ "Research goal: " + $json.goal + "\\nQuestion: " + $json.research_question + "\\n\\nSearch evidence:\\n" + $json.evidence_text + "\\n\\nAvailable sources (title | url):\\n" + $json.sources.map(s => s.title + " | " + s.url).join("\\n") }}') }
                      ]
            },
      simplify: true,
      options: { textFormat: { textOptions: { type: 'json_object' } } }
    },
    credentials: { openAiApi: newCredential('Gateway credits') }
  }
});

const synthesize_Findings_Fallback = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Synthesize Findings (Fallback)',
    parameters: {
      method: 'POST',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ model: "openrouter/free", messages: [ { role: "system", content: "You are the synthesis component of the ULTRON Research Agent. Given a research goal and web search results, produce a single valid JSON object only (no markdown): { summary, findings, facts, conclusions, uncertainties, sources: [{title,url,source_type,relevance}] }. Only cite sources present in the results; never invent URLs; separate facts from conclusions; put conflicts in uncertainties." }, { role: "user", content: "Research goal: " + $json.goal + " Question: " + $json.research_question + " Search evidence: " + $json.evidence_text + " Available sources: " + $json.sources.map(s => s.title + " | " + s.url).join(", ") } ] }) }}'),
      options: { timeout: 90000, response: { response: { responseFormat: 'json' } } }
    },
    credentials: { openAiApi: newCredential('OpenRouter Free (Hassan)', '7KPXGh1aa4Ob25rQ') }
  }
});

const reshape_Synth_Fallback = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Reshape Synth Fallback',
    parameters: {
      jsCode: `const j = $input.item.json;
const text = (j.choices && j.choices[0] && j.choices[0].message) ? j.choices[0].message.content : '';
return [{ json: { output: [{ content: [{ text }] }] } }];`
    }
  }
});

const build_Result = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    id: 'b6f03f2f-2d53-4ba1-a96f-042a3b0b1cdd',
    name: 'Build Result',
    parameters: {
      jsCode: `const collected = $('Collect Results').item.json;
let raw;
try { raw = $input.item.json.output[0].content[0].text; } catch (e) { raw = undefined; }
let parsed;
if (raw && typeof raw === 'object') parsed = raw;
else if (typeof raw === 'string') { try { parsed = JSON.parse(raw); } catch (e) { parsed = null; } }
function fail(m) { return [{ json: { success: false, error: m, sources: [] } }]; }
if (!parsed) return fail('Could not synthesize research findings.');

// Use only real collected sources; never trust AI-invented URLs
const realSources = collected.sources.map(s => ({ title: s.title, url: s.url, source_type: s.source_type, relevance: s.relevance }));
const aiSources = Array.isArray(parsed.sources) ? parsed.sources : [];
// Keep AI sources only if their URL matches a real collected source URL
const realUrls = new Set(realSources.map(s => s.url));
const verifiedAiSources = aiSources.filter(s => s && s.url && realUrls.has(s.url));
const finalSources = verifiedAiSources.length ? verifiedAiSources : realSources;

return [{
  json: {
    success: true,
    research_question: collected.research_question,
    summary: parsed.summary || '',
    findings: Array.isArray(parsed.findings) ? parsed.findings : [],
    facts: Array.isArray(parsed.facts) ? parsed.facts : [],
    conclusions: Array.isArray(parsed.conclusions) ? parsed.conclusions : [],
    uncertainties: Array.isArray(parsed.uncertainties) ? parsed.uncertainties : [],
    sources: finalSources,
    searches_performed: collected.searches_performed,
  },
}];`
    }
  }
});

const respond_Result = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { id: 'f7a64b1c-2b7f-4a39-880c-a32579948376', name: 'Respond Result', parameters: { respondWith: 'json', responseBody: expr('{{ $json }}') } }
});

const respond_Error = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { id: '646cc6c9-0291-48ae-8627-1b0b3e4a481f', name: 'Respond Error', parameters: { respondWith: 'json', responseBody: expr('{{ $json }}') } }
});

const receive_Request = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2,
  config: { id: 'd01fd764-5465-49b9-98c2-f66b6c49bee1', name: 'Receive Request', parameters: { httpMethod: 'POST', path: 'ultron-research', responseMode: 'responseNode', options: {} }, webhookId: '2541fceb-7b13-4d9f-9b8d-5d97a331371b' }
});

const wf = workflow('NnN78iuswGOWsr8Z', 'ULTRON - Research Agent', { executionOrder: 'v1', binaryMode: 'separate', timeSavedMode: 'fixed', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false });

export default wf
  .add(called_as_Sub_workflow)
  .to(normalize_Input)
  .to(valid.onTrue(generate_Search_Queries
    .to(expand_Queries)
    .onError(generate_Search_Queries_Fallback
      .to(reshape_Search_Fallback)
      .to(expand_Queries))
    .to(brave_Web_Search)
    .to(collect_Results)
    .to(synthesize_Findings
      .to(build_Result)
      .onError(synthesize_Findings_Fallback
        .to(reshape_Synth_Fallback)
        .to(build_Result)))
    .to(respond_Result)).onFalse(respond_Error))
  .add(receive_Request)
  .to(normalize_Input)