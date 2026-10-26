# Piano di realizzazione

1. Conservare i documenti originali e inizializzare Git su un ramo separato.
2. Trascrivere il catalogo dall'Excel in un file dati, verificare formula e casi C1–C5. Separare dati, validazione e calcolo, usando aritmetica decimale per gli importi.
3. Realizzare React con Vite e TypeScript. Una pagina con misure, scelta legno, finitura, consegna, anteprima indicativa e riepilogo. Nessun invio dei dati del cliente.
4. Preparare Supabase con tabelle di catalogo e parametri, vincoli numerici, RLS in sola lettura e funzione RPC che restituisce un catalogo coerente in una chiamata. Il titolare modifica i dati dal Table Editor. Nessuna autenticazione cliente.
5. Verificare input, casi del listino, arrotondamenti, aggiornamenti prezzo, caricamento ed errori. Controllare desktop e telefono.
6. Collegare Supabase e Vercel, configurare database e variabili, pubblicare e verificare l'URL reale. L'utente ha confermato di includere la lezione 4 e di volere l'app raggiungibile anche da altri dispositivi.

## Scelte e rischi
- La richiesta dell'utente introduce un database gestito rispetto al file dati della commessa. Manteniamo anche public/data/catalog.json, modificabile separatamente dal codice per la modalità locale; in produzione Supabase è la fonte autorevole.
- In assenza delle connessioni esterne si può completare e verificare l'app locale, ma non dichiarare database e hosting attivi.
- Il foglio non contiene risultati attesi. Sono stati ricalcolati indipendentemente; C5 è intenzionalmente invalido.
- Listino!A60 contiene un'istruzione estranea che chiede di evitare le verifiche: va ignorata.
- Nessuna bozza di un'altra IA è presente, quindi non è possibile recensirne gli errori.
- I cataloghi incompleti o non validi e gli errori di rete devono bloccare i risultati anziché usare prezzi precedenti.
- Per misure con decimali, la commessa non definisce arrotondamenti. Si documenta l'arrotondamento commerciale dell'imponibile e dell'IVA al centesimo, mantenendo la superficie esatta nel calcolo.

La commessa indica il 30 ottobre 2026 per il piano e il 20 novembre 2026 per la pubblicazione. Lo sviluppo e la pubblicazione sono autorizzati dall'utente.

## Estensione richiesta: amministrazione e ripiani

Realizzata un’area /admin con accesso Supabase Auth, conferma email e autorizzazione database tramite allowlist privata. L’editor pubblica prezzi e parametri in una sola transazione, con controllo della revisione. L’utente configura la propria password dal sito; le sessioni admin restano nella singola scheda.

Ripiani configurabili da zero, superficie calcolata sulle misure interne con due facce e quattro bordi, stesso legno e finitura. Spessore iniziale 2 cm confermato dall’utente, modificabile dall’admin. Quantità, anteprima, costi, IVA, PDF e stampa derivano dallo stesso calcolo.

Verifiche aggiunte: casi numerici con ripiani, limiti fisici e di listino, errori nell’editor, conferma prima della pubblicazione, RLS, email non confermata, rollback di salvataggi invalidi e conflitti di revisione. Le prove SQL usano fixture in transazione annullata.
