import { FormEvent, Fragment, useEffect, useRef, useState } from 'react';
import { LoaderCircle, MessageCircle, Send, X } from 'lucide-react';

type Session = { id: string; token: string };
type ChatItem = { role: 'user' | 'assistant'; content: string };
const SESSION_KEY = 'legno-co-chat-session';
const MAX_LENGTH = 500;

function formatAssistantText(text: string) {
  return text.split('\n').map((line, lineIndex) => {
    const bullet = /^\s*[-*]\s+/.test(line);
    const content = bullet ? line.replace(/^\s*[-*]\s+/, '') : line;
    const parts = content.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith('**') && part.endsWith('**')
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : <Fragment key={index}>{part}</Fragment>);
    return <Fragment key={lineIndex}>{lineIndex > 0 && <br />}<span className={bullet ? 'chat-line chat-bullet' : 'chat-line'}>{parts}</span></Fragment>;
  });
}

function readSession(): Session | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const session = value as Session;
    return typeof session.id === 'string' && typeof session.token === 'string' ? session : null;
  } catch { return null; }
}

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [open, messages, busy]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || busy || text.length > MAX_LENGTH) return;
    setMessage(''); setError(null); setMessages(current => [...current, { role: 'user', content: text }]); setBusy(true);
    try {
      const response = await fetch('/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messaggio: text, sessione: readSession() }) });
      const data: unknown = await response.json();
      if (!response.ok || !data || typeof data !== 'object') throw new Error('Assistente non disponibile');
      const result = data as { risposta?: unknown; sessione?: unknown; errore?: unknown };
      if (typeof result.risposta !== 'string') throw new Error(typeof result.errore === 'string' ? result.errore : 'Assistente non disponibile');
      if (result.sessione && typeof result.sessione === 'object') localStorage.setItem(SESSION_KEY, JSON.stringify(result.sessione));
      setMessages(current => [...current, { role: 'assistant', content: result.risposta as string }]);
    } catch { setError('Non riesco a rispondere in questo momento. Riprova tra poco.'); }
    finally { setBusy(false); }
  };

  return <>
    <button className={`chat-launcher ${open ? 'is-open' : ''}`} aria-label={open ? 'Chiudi assistente' : 'Apri assistente'} aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? <X size={21} /> : <MessageCircle size={21} />}<span>{open ? 'Chiudi' : 'Chiedi a Legno & Co.'}</span></button>
    {open && <section className="chat-panel" aria-label="Assistente Legno & Co.">
      <header className="chat-header"><div><span className="chat-status-dot" /> Assistente Legno & Co.<small>Risponde sul listino disponibile</small></div><button aria-label="Chiudi assistente" onClick={() => setOpen(false)}><X size={18} /></button></header>
      <div className="chat-messages" aria-live="polite">
        {messages.length === 0 && <div className="chat-welcome"><MessageCircle size={25} /><strong>Come posso aiutarti?</strong><p>Chiedimi informazioni su legni, finiture, consegna e prezzi del listino.</p></div>}
        {messages.map((item, index) => <div className={`chat-bubble ${item.role}`} key={`${item.role}-${index}`}>{item.role === 'assistant' ? formatAssistantText(item.content) : item.content}</div>)}
        {busy && <div className="chat-bubble assistant chat-loading"><LoaderCircle className="spin" size={15} /> Sto controllando il listino…</div>}
        {error && <p className="chat-error" role="alert">{error}</p>}<div ref={endRef} />
      </div>
      <form className="chat-form" onSubmit={submit}><label className="sr-only" htmlFor="chat-message">Scrivi una domanda</label><textarea id="chat-message" value={message} maxLength={MAX_LENGTH} rows={2} placeholder="Scrivi una domanda…" disabled={busy} onChange={event => setMessage(event.target.value)} /><button type="submit" aria-label="Invia messaggio" disabled={busy || !message.trim()}><Send size={17} /></button><small>{message.length}/{MAX_LENGTH}</small></form>
    </section>}
  </>;
}
