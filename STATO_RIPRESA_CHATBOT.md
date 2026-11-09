# Stato di ripresa — chatbot Legno & Co.

Aggiornato: 9 novembre 2026

## Progetto

- Sito: https://legno-co-preventivatore.vercel.app/
- Repository: https://github.com/ThommySanto/legno-co-preventivatore
- Branch attuale: `main`
- Ultimo commit locale/pubblicato: `947020b`
- Deploy Vercel più recente rilevato: commit `947020b`, ancora in compilazione al momento della pausa.
- `dispense/` è ignorata da Git e non deve essere modificata né inclusa nel deploy.
- `RIEPILOGO_CHATBOT.md` è un vecchio riepilogo non tracciato; non contiene il nuovo stato operativo.

## Completato e verificato

### Blocchi 1–3

- `POST /api/assistant` server-side con Claude Haiku e chiavi solo lato server.
- Sessione privata anonima con token casuale, hash in Supabase, RLS e memoria conversazionale.
- Widget chatbot visibile nel sito.
- Rendering del Markdown nelle risposte.
- Rifiuto rigoroso per prodotti assenti dal catalogo.

### Blocco 4

- Catalogo prodotti esteso a 60 prodotti in `public.product_catalog`.
- Ricerca prodotti tramite tool `cerca_prodotti`.
- Carrello privato con aggiunta, lettura, rimozione, svuotamento confermato e calcolo deterministico del preventivo.
- Il carrello è visibile nella chat.
- Le modifiche del chatbot aggiornano i campi del configuratore tramite evento `legno-co:assistant-config`.
- Normalizzazione dei nomi Supabase camelCase/snake_case già corretta.
- Il clic su “Configura questo prodotto” dal catalogo precompila le misure consigliate e un legno compatibile.

### Blocco 5

- 16 documenti FAQ importati in `public.faq_documents`.
- RPC `search_faq_documents` con ricerca testuale e fonte.
- Tool `cerca_faq` integrato nell’assistente.
- Test reale riuscito sulla garanzia dei mobili da esterno con citazione delle fonti.

### Blocco 6

- Endpoint server `POST /api/request` per estrazione e validazione delle richieste preventivo.
- Calcolo di area, imponibile, IVA e totale eseguito dal codice.
- Test reale riuscito per richiesta completa e richiesta incompleta.

### Blocchi 7–8

- Tabella privata `private.chat_events`.
- RPC `log_chat_event` con verifica del token della sessione.
- Registrazione di messaggi, modifiche carrello e preventivi; gli errori analytics non interrompono il cliente.
- RPC `get_chat_report`, riservata agli amministratori autenticati.
- Area admin con KPI aggregati: messaggi, sessioni, azioni carrello e preventivi.
- Nessun testo delle conversazioni viene mostrato nel report.

## Test già eseguiti

- `npm run build` riuscito più volte.
- FAQ in produzione riuscita.
- Memoria in produzione verificata con due richieste nella stessa sessione.
- Prodotto catalogato “Tavolo da pranzo” verificato in produzione con:
  - Noce;
  - misure minime 120 × 75 × 70 cm;
  - finitura Grezzo;
  - ritiro in sede;
  - totale verificato 1.381,65 € IVA inclusa.
- Prodotto non presente “Tavolo bar” correttamente rifiutato.
- Endpoint `/api/request` testato su casi completi e incompleti.
- `git ls-files dispense` non restituisce file.

## Da fare alla ripresa

1. Controllare che il deploy del commit `947020b` sia diventato `READY` e che il dominio pubblico punti a quello corretto.
2. Verificare dall’area admin il nuovo report dopo un accesso amministratore reale.
3. Fare un test browser desktop/mobile del catalogo, carrello e sincronizzazione chatbot → configuratore.
4. Collegare il prodotto selezionato anche alla geometria del modello 3D: oggi il configuratore aggiorna misure, legno e finitura, ma il modello resta una rappresentazione generica del mobile.
5. Se richiesto, ampliare il report con grafici giornalieri, distribuzioni per prodotto/legno/finitura/consegna e commento LLM controllato sui numeri.
6. Ripetere build, test endpoint, controllo `dispense/` e deploy dopo ogni modifica.

## Regole da non cambiare

- Usare sempre Claude Haiku.
- Non esporre chiavi Anthropic, Supabase o Vercel nel browser o nel repository.
- Non riattivare protezioni Vercel sul sito pubblico.
- Non modificare né tracciare `dispense/`.
