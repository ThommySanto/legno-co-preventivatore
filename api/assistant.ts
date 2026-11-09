const MAX_MESSAGE_LENGTH = 500;
const ANTHROPIC_MODEL = 'claude-haiku-5-5';
const MAX_HISTORY_MESSAGES = 12;
const RECENT_MESSAGES_TO_KEEP = 6;

type CatalogItem = {
  name: string;
  description: string;
  pricePerM2?: number;
  price?: number;
};

type PricingCatalog = {
  woods: CatalogItem[];
  finishes: CatalogItem[];
  deliveries: CatalogItem[];
  settings: { vatRate: number; minDimensionCm: number; maxDimensionCm: number };
};

type ChatSession = { id: string; token: string };
type ChatMessage = { id: number; role: 'user' | 'assistant'; content: string };
type ChatMemory = { summary: string; summaryMessageCount: number; messages: ChatMessage[] };
type ClaudeMessage = { role: 'user' | 'assistant'; content: unknown };
type ToolCall = { id: string; name: string; input: Record<string, unknown> };

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function isPricingCatalog(value: unknown): value is PricingCatalog {
  if (!value || typeof value !== 'object') return false;
  const catalog = value as Partial<PricingCatalog>;
  return Array.isArray(catalog.woods)
    && Array.isArray(catalog.finishes)
    && Array.isArray(catalog.deliveries)
    && !!catalog.settings
    && typeof catalog.settings.vatRate === 'number'
    && typeof catalog.settings.minDimensionCm === 'number'
    && typeof catalog.settings.maxDimensionCm === 'number';
}

function requestComesFromThisApp(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function loadCatalog(): Promise<PricingCatalog> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase non configurato');

  const response = await fetch(`${url}/rest/v1/rpc/get_pricing_catalog`, {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Listino Supabase non disponibile');

  const catalog: unknown = await response.json();
  if (!isPricingCatalog(catalog)) throw new Error('Listino Supabase non valido');
  return catalog;
}

function supabaseConfig() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase non configurato');
  return { url, key };
}

async function rpc<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(params),
    cache: 'no-store',
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Supabase RPC ${name} non disponibile`);
  return (body ? JSON.parse(body) : undefined) as T;
}

function validSession(value: unknown): value is ChatSession {
  return !!value && typeof value === 'object'
    && typeof (value as ChatSession).id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test((value as ChatSession).id)
    && typeof (value as ChatSession).token === 'string'
    && /^[0-9a-f]{64}$/i.test((value as ChatSession).token);
}

async function openSession(): Promise<ChatSession> {
  const session = { id: crypto.randomUUID(), token: Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('') };
  await rpc<void>('open_chat_session', { session_id: session.id, access_token: session.token });
  return session;
}

async function readMemory(session: ChatSession): Promise<ChatMemory> {
  const memory = await rpc<ChatMemory | null>('read_chat_memory', { session_id: session.id, access_token: session.token });
  if (!memory || !Array.isArray(memory.messages)) throw new Error('Sessione non trovata');
  return memory;
}

async function appendMessage(session: ChatSession, role: ChatMessage['role'], content: string) {
  await rpc<void>('append_chat_message', { session_id: session.id, access_token: session.token, message_role: role, message_content: content });
}

function systemPrompt(catalog: PricingCatalog): string {
  return `<ruolo>
Sei l'assistente di Legno & Co. Rispondi esclusivamente in italiano, con tono cordiale e breve.
</ruolo>

<listino>
${JSON.stringify(catalog)}
</listino>

<regole>
- Usa soltanto il listino ricevuto sopra. Se un dato manca, dichiaralo: non inventare mai prezzi, prodotti, sconti, IVA o caratteristiche.
- Se l'utente chiede un prodotto, modello o caratteristica che non compare esplicitamente nel listino, rispondi soltanto che non è presente nel listino. Non usare altri dati del listino come alternativa, non proporre un prodotto diverso e non dare consigli: aspetta una nuova richiesta.
- Non dedurre l'esistenza di un prodotto dai materiali, dalle finiture, dalle misure o dai prezzi al metro quadrato. Materiale disponibile non significa prodotto disponibile.
- Gli importi del listino sono IVA esclusa. Scrivi gli euro nel formato italiano, ad esempio 1.234,56 €.
- Questo e' il blocco 1: non calcolare superfici, IVA o preventivi completi a mente. Se l'utente fornisce misure, comunica i prezzi applicabili e spiega che il calcolo esatto arrivera' nel blocco successivo.
- Per prodotti, carrello e preventivi usa sempre gli strumenti disponibili. Non calcolare mai un totale a mente e non inventare l'identificativo di un prodotto.
- Per domande su garanzia, consegne, cura, resi, montaggio, finiture, legni, pagamenti, misure, contatti o altri servizi usa cerca_faq e rispondi solo dalle fonti restituite; cita sempre la fonte.
- Per aggiungere un prodotto cerca prima nel catalogo; usa solo gli id restituiti da cerca_prodotti.
- Per svuotare il carrello chiedi conferma esplicita e chiama lo strumento solo dopo una risposta affermativa.
- Non mostrare ragionamenti interni.
</regole>`;
}

const tools = [
  { name: 'cerca_faq', description: 'Cerca nelle FAQ aziendali una risposta documentata. Usalo per informazioni non contenute nel listino prezzi.', input_schema: { type: 'object', properties: { testo: { type: 'string' } }, required: ['testo'] } },
  { name: 'cerca_prodotti', description: 'Cerca prodotti nel catalogo per testo e/o categoria.', input_schema: { type: 'object', properties: { testo: { type: 'string' }, categoria: { type: 'string' } }, required: [] } },
  { name: 'aggiungi_al_carrello', description: 'Aggiunge un prodotto configurato. Cerca prima il prodotto e rispetta i limiti restituiti.', input_schema: { type: 'object', properties: { prodotto_id: { type: 'string' }, larghezza: { type: 'number' }, altezza: { type: 'number' }, profondita: { type: 'number' }, legno: { type: 'string' }, finitura: { type: 'string' }, quantita: { type: 'integer', minimum: 1, maximum: 20 } }, required: ['prodotto_id','larghezza','altezza','profondita','legno','finitura','quantita'] } },
  { name: 'mostra_carrello', description: 'Mostra le righe del carrello numerate.', input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'rimuovi_dal_carrello', description: 'Rimuove una riga del carrello.', input_schema: { type: 'object', properties: { riga: { type: 'integer', minimum: 1 } }, required: ['riga'] } },
  { name: 'svuota_carrello', description: 'Svuota il carrello solo dopo conferma esplicita.', input_schema: { type: 'object', properties: { confermato: { type: 'boolean' } }, required: ['confermato'] } },
  { name: 'calcola_preventivo', description: 'Calcola il preventivo del carrello. Riporta esattamente i numeri restituiti.', input_schema: { type: 'object', properties: { consegna: { type: 'string' } }, required: ['consegna'] } },
];

async function runTool(session: ChatSession, call: ToolCall): Promise<string> {
  const input = call.input;
  if (call.name === 'cerca_faq') return JSON.stringify(await rpc('search_faq_documents', { search_text: input.testo ?? '', limit_count: 3 }));
  if (call.name === 'cerca_prodotti') return JSON.stringify(await rpc('search_product_catalog', { search_text: input.testo ?? '', search_category: input.categoria ?? '' }));
  if (call.name === 'aggiungi_al_carrello') return JSON.stringify(await rpc('add_chat_cart_item', { session_id: session.id, access_token: session.token, product_id: input.prodotto_id, width_cm: input.larghezza, height_cm: input.altezza, depth_cm: input.profondita, wood: input.legno, finish: input.finitura, quantity: input.quantita }));
  if (call.name === 'mostra_carrello') return JSON.stringify(await rpc('read_chat_cart', { session_id: session.id, access_token: session.token }));
  if (call.name === 'rimuovi_dal_carrello') { await rpc('remove_chat_cart_item', { session_id: session.id, access_token: session.token, row_number: input.riga }); return 'Riga rimossa.'; }
  if (call.name === 'svuota_carrello') { await rpc('clear_chat_cart', { session_id: session.id, access_token: session.token, confirmed: input.confermato }); return 'Carrello svuotato.'; }
  if (call.name === 'calcola_preventivo') {
    const requested = String(input.consegna ?? '').trim().toLowerCase();
    const delivery = requested.includes('oltre') ? 'Oltre 50 km' : requested.includes('entro') ? 'Entro 50 km' : requested.includes('ritiro') ? 'Ritiro in sede' : input.consegna;
    return JSON.stringify(await rpc('calculate_chat_quote', { session_id: session.id, access_token: session.token, delivery }));
  }
  throw new Error('Strumento non disponibile');
}

async function callClaude(system: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Anthropic non configurato');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 512,
      system,
      messages,
    }),
  });
  if (!response.ok) throw new Error(`Anthropic HTTP ${response.status}`);

  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') throw new Error('Risposta Anthropic non valida');
  const result = data as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const answer = result.content
    ?.filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .join('')
    .trim();
  if (!answer) throw new Error('Risposta Anthropic senza testo');

  const inputTokens = result.usage?.input_tokens ?? 0;
  const outputTokens = result.usage?.output_tokens ?? 0;
  const estimatedCost = inputTokens / 1_000_000 + (outputTokens * 5) / 1_000_000;
  console.info(JSON.stringify({ event: 'assistant_response', model: ANTHROPIC_MODEL, inputTokens, outputTokens, estimatedCost }));
  return answer;
}

async function callClaudeWithTools(system: string, initialMessages: ClaudeMessage[], session: ChatSession): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Anthropic non configurato');
  const messages = [...initialMessages];
  for (let turn = 0; turn < 6; turn += 1) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 700, system, tools, messages }),
    });
    if (!response.ok) throw new Error(`Anthropic HTTP ${response.status}`);
    const result = await response.json() as { stop_reason?: string; content?: Array<{ type?: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }> };
    const blocks = result.content ?? [];
    const calls = blocks.filter(block => block.type === 'tool_use' && block.id && block.name).map(block => ({ id: block.id!, name: block.name!, input: block.input ?? {} }));
    if (result.stop_reason !== 'tool_use' || !calls.length) {
      const answer = blocks.filter(block => block.type === 'text' && typeof block.text === 'string').map(block => block.text).join('').trim();
      if (!answer) throw new Error('Risposta Anthropic senza testo');
      return answer;
    }
    messages.push({ role: 'assistant', content: blocks });
    const results = [];
    for (const call of calls) {
      try { results.push({ type: 'tool_result', tool_use_id: call.id, content: await runTool(session, call) }); }
      catch (error) { results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: error instanceof Error ? `Errore: ${error.message}` : 'Errore strumento' }); }
    }
    messages.push({ role: 'user', content: results });
  }
  throw new Error('Troppi passaggi degli strumenti');
}

async function summarizeMemory(memory: ChatMemory): Promise<{ summary: string; summarizedMessages: number }> {
  const olderMessages = memory.messages.slice(0, -RECENT_MESSAGES_TO_KEEP);
  if (!olderMessages.length) return { summary: memory.summary, summarizedMessages: memory.summaryMessageCount };
  const summary = await callClaude(
    'Riassumi in italiano i dati utili della conversazione: nome, misure, legno, finitura, consegna e richieste. Non inventare. Massimo 180 parole.',
    [{ role: 'user', content: JSON.stringify({ riepilogoPrecedente: memory.summary, messaggi: olderMessages.map(({ role, content }) => ({ role, content })) }) }],
  );
  return { summary, summarizedMessages: memory.summaryMessageCount + olderMessages.length };
}

async function askClaude(message: string, catalog: PricingCatalog, memory: ChatMemory, session: ChatSession) {
  const recent = memory.messages
    .slice(-RECENT_MESSAGES_TO_KEEP)
    .map(({ role, content }) => ({ role, content }));
  while (recent[0]?.role === 'assistant') recent.shift();
  if (!recent.length) recent.push({ role: 'user', content: message });
  const prompt = memory.summary ? `${systemPrompt(catalog)}\n\n<riassunto_conversazione>\n${memory.summary}\n</riassunto_conversazione>` : systemPrompt(catalog);
  return callClaudeWithTools(prompt, recent, session);
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') return json(405, { errore: 'Metodo non consentito.' });
    if (!requestComesFromThisApp(request)) return json(403, { errore: 'Origine non autorizzata.' });

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return json(400, { errore: 'Richiesta non valida.' });
    }
    const message = payload && typeof payload === 'object' ? (payload as { messaggio?: unknown }).messaggio : undefined;
    if (typeof message !== 'string' || !message.trim() || message.trim().length > MAX_MESSAGE_LENGTH) {
      return json(400, { errore: `Il messaggio deve contenere da 1 a ${MAX_MESSAGE_LENGTH} caratteri.` });
    }

    try {
      const catalog = await loadCatalog();
      const suppliedSession = payload && typeof payload === 'object' ? (payload as { sessione?: unknown }).sessione : undefined;
      const session = validSession(suppliedSession) ? suppliedSession : await openSession();
      let memory = await readMemory(session);
      await appendMessage(session, 'user', message.trim());
      await rpc<void>('log_chat_event', { p_session_id: session.id, p_access_token: session.token, p_event_type: 'message', p_input_chars: message.trim().length });
      memory = { ...memory, messages: [...memory.messages, { id: 0, role: 'user', content: message.trim() }] };
      if (memory.messages.length > MAX_HISTORY_MESSAGES) {
        const next = await summarizeMemory(memory);
        await rpc<void>('update_chat_summary', { session_id: session.id, access_token: session.token, next_summary: next.summary, summarized_messages: next.summarizedMessages });
        memory = { ...memory, summary: next.summary, summaryMessageCount: next.summarizedMessages, messages: memory.messages.slice(-RECENT_MESSAGES_TO_KEEP) };
      }
      const answer = await askClaude(message.trim(), catalog, memory, session);
      await appendMessage(session, 'assistant', answer);
      const carrello = await rpc('read_chat_cart', { session_id: session.id, access_token: session.token });
      return json(200, { risposta: answer, sessione: session, carrello });
    } catch (error) {
      console.error('assistant_request_failed', error instanceof Error ? error.message : 'errore sconosciuto');
      return json(503, { errore: 'Assistente non disponibile. Riprova tra poco.' });
    }
  },
};
