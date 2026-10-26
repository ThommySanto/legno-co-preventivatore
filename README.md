# Legno & Co. Preventivatore

Applicazione React e TypeScript per configurare mobili su misura. Supabase conserva il catalogo e gestisce l’accesso amministratore; i preventivi non vengono salvati. Vercel pubblica il frontend statico. L’azienda e il listino iniziale sono inventati per un progetto didattico.

[Apri l’applicazione online](https://legno-co-preventivatore.vercel.app).

## Avvio

Richiede Node 22.12 o successivo.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Su Windows copiare `.env.example` in `.env.local` da Esplora file o con `Copy-Item`. La modalità `local` legge `public/data/catalog.json`. Non richiede credenziali e mostra esplicitamente la modalità anteprima.

## Supabase

Applicare in ordine le migrazioni in `supabase/migrations` a un progetto vuoto. Esse creano `woods`, `finishes`, `delivery_options`, `pricing_settings` e la funzione di sola lettura `get_pricing_catalog`.

In `.env.local` impostare:

```dotenv
VITE_CATALOG_SOURCE=supabase
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=CHIAVE_PUBBLICABILE_DEL_PROGETTO
```

La chiave deve essere del tipo `sb_publishable_…`. Non usare una chiave secret o service_role. URL e chiave pubblicabile sono leggibili nel frontend per progettazione; la sicurezza delle scritture è garantita da privilegi SQL e RLS, non dall'occultamento della chiave. Il file `.env.local` è escluso da Git.

Il caricamento usa un'unica RPC in lettura, con un catalogo coerente. Un listino errato, incompleto o non disponibile blocca i prezzi. In modalità Supabase non viene mai usato il JSON locale come ripiego. Il catalogo viene riletto all'apertura, quando si torna sulla scheda, quando torna la connessione e con il pulsante «Aggiorna il listino». L'aggiornamento conserva misure e scelte ancora disponibili.

## Modificare il listino senza codice

Aprire /admin sul sito. Al primo accesso scegliere «Primo accesso», inserire l’email autorizzata e una password di almeno 12 caratteri, quindi confermare l’email. Per i successivi accessi usare email e password. È disponibile anche il recupero password. Le email sono inviate solo su richiesta dell’amministratore.

L’editor permette di modificare i prezzi, l’IVA in percentuale, i limiti delle misure, lo spessore dei pannelli/ripiani e il numero massimo di ripiani. Accetta punto o virgola, valida gli importi e mostra un riepilogo prima della pubblicazione. Un’unica transazione applica tutte le modifiche; una revisione impedisce che una scheda sovrascriva un listino già aggiornato. Le bozze non vengono salvate nel browser. I clienti rileggono il catalogo all’apertura, al ritorno sulla scheda o usando «Aggiorna il listino».

Configurazione per un nuovo progetto: tenere abilitata la conferma email in Supabase Auth e impostare Site URL sull’URL HTTPS esatto della pagina /admin. Con il servizio email predefinito Supabase, il destinatario deve appartenere al team del progetto; per indirizzi esterni serve un SMTP configurato. Inserire l’email autorizzata nella tabella privata tramite SQL amministrativo, mai da un client pubblico:

```sql
insert into private.catalog_admins(email) values (lower('EMAIL_AUTORIZZATA'));
```

Non basta registrarsi: il database verifica a ogni scrittura che l’email Auth sia confermata e presente nell’allowlist privata. Non usa user_metadata. Non distribuire chiavi amministrative né password. La sessione admin è conservata solo in sessionStorage con chiave legno-co:admin-auth:v1; usare «Esci» su dispositivi condivisi.

Il Table Editor rimane disponibile per gestione tecnica di nomi, descrizioni e disponibilità. I campi sono:

| Tabella | Campo | Significato |
| --- | --- | --- |
| `woods` | `price_per_m2` | Prezzo legno in euro/m², IVA esclusa |
| `finishes` | `price_per_m2` | Supplemento finitura in euro/m², IVA esclusa |
| `delivery_options` | `price` | Costo fisso in euro, IVA esclusa |
| `pricing_settings` | `vat_rate` | Aliquota decimale: 0.22 = 22% |
| `pricing_settings` | `min_dimension_cm`, `max_dimension_cm` | Limiti per ciascuna misura |

`name` e `description` controllano i testi delle opzioni. `sort_order` ne controlla l'ordine. `active=false` nasconde un'opzione; deve restarne almeno una attiva per ogni categoria. Non modificare gli ID delle opzioni esistenti. `color` accetta un colore esadecimale, ad esempio `#b99465`. I colori e le descrizioni sono indicativi, non certificazioni del materiale.

Non serve ricompilare o pubblicare di nuovo per cambiare i dati su Supabase. Aprire la pagina e premere «Aggiorna il listino». Per la modalità locale modificare il JSON separato; un sito statico già pubblicato richiede un nuovo deploy per aggiornare quel file.

## Calcolo e verifiche

Con L, H e P in centimetri:

```text
superficie m² = 2 × (L×H + L×P + H×P) / 10000
larghezza ripiano = L − 2 × spessore
profondità ripiano = P − spessore
area ripiani = quantità × 2 × (larghezza ripiano × profondità ripiano + larghezza ripiano × spessore + profondità ripiano × spessore) / 10000
imponibile = arrotonda((superficie + area ripiani) × (prezzo legno + finitura) + consegna, 2)
IVA = arrotonda(imponibile × aliquota, 2)
totale = imponibile + IVA
```

I casi originali seguenti hanno zero ripiani. Con C1 e due ripiani di spessore 2 cm: dimensioni utili 116 × 38 cm, superficie ripiani 1,8864 m², costo ripiani 362,19 €, imponibile 1.098,03 €, IVA 241,57 €, totale 1.339,60 €. La quantità è intera e non può superare il massimo del listino né occupare tutta l’altezza interna. Un’eventuale differenza di un centesimo tra la somma delle voci arrotondate e l’imponibile viene esposta come arrotondamento.

Si usa aritmetica decimale e arrotondamento commerciale, senza arrotondare la superficie prima del calcolo. Limiti inclusivi, numeri positivi, punto o virgola decimale. Non vengono accettate espressioni, unità nel campo numerico o notazione scientifica.

| Caso Excel | Superficie | Imponibile | IVA | Totale |
| --- | ---: | ---: | ---: | ---: |
| C1 | 3,52 m² | 735,84 € | 161,88 € | 897,72 € |
| C2 | 7 m² | 595,00 € | 130,90 € | 725,90 € |
| C3 | 5,13 m² | 1.530,75 € | 336,77 € | 1.867,52 € |
| C4 | 4,95 m² | 941,10 € | 207,04 € | 1.148,14 € |
| C5 | — | — | — | Misura non valida: larghezza 20 cm |

```sh
npm run check
```

I test verificano i casi dell'Excel, limiti e input errati, decimali, arrotondamenti, modifiche ai prezzi e parametri, privacy delle richieste, errori di caricamento, aggiornamento e reset dell'interfaccia. `npm run build` esegue anche il controllo TypeScript. Le verifiche SQL in supabase/tests/admin_security.sql controllano RLS, email confermata, transazione atomica e conflitto di revisione; tutte le fixture e le modifiche vengono annullate con rollback.

## Vercel

Importare questa repository, scegliere Vite e aggiungere le tre variabili d'ambiente Supabase a Production e Preview. Build: `npm run build`; directory finale: `dist`; Node: 24.x. `vercel.json` contiene le intestazioni di sicurezza. La CSP ammette richieste soltanto alla stessa origine e ai progetti `*.supabase.co`.

Non caricare mai `.env.local`, `node_modules` o la cartella `.vercel`. Nessun segreto va incluso nel codice, nella documentazione o nei log. Non occorrono servizi a pagamento, domini personalizzati o account dei clienti. Conferma email e recupero password sono riservati all’amministratore.

## Privacy e interfaccia

Lo studio 3D permette di ruotare il mobile con il trascinamento, ingrandire e ridurre con i pulsanti, scegliere prospettiva, fronte e retro, mostrare misure e dettagli, separare visivamente i pannelli e aprire una vista ingrandita. Da tastiera: frecce per ruotare, +/− per lo zoom, Home per ripristinare; Escape chiude la vista ingrandita. La rotazione automatica è facoltativa. Su telefono lo scorrimento verticale della pagina resta disponibile; lo zoom supporta anche il gesto a due dita. Con mouse si può usare Ctrl + rotellina; la rotellina ordinaria continua a scorrere la pagina.

Il modello è indicativo e non esegue verifiche costruttive. I comandi del 3D non cambiano misure, materiali, ripiani o importi. Le venature sono generate sul dispositivo, senza servizi esterni o immagini scaricate. Il motore Three.js viene caricato soltanto in prossimità dell’anteprima; rendering e rotazione si sospendono quando il modello o la scheda non sono visibili. Le risorse grafiche vengono liberate quando si chiude il visualizzatore. Su dispositivi senza WebGL 2 rimane l’anteprima illustrata. Le animazioni rispettano prefers-reduced-motion; PDF e stampa mantengono il modello A4 statico.

Il selettore «Chiaro / Scuro» nell'intestazione cambia l'aspetto senza azzerare il preventivo. Il tema chiaro originale resta predefinito; il tema scuro usa verde bosco, testo avorio e accenti lime. Per il visitatore si salva soltanto la preferenza del tema, con la chiave `legno-co:theme:v1`, senza inviarla a servizi esterni. L’area admin conserva separatamente la sessione di accesso nella singola scheda, come descritto sopra. Se il browser impedisce il salvataggio, il selettore continua a funzionare nella pagina aperta. La stampa resta chiara in entrambi i temi.

Le misure e le scelte vivono esclusivamente nello stato React, non sono salvate in localStorage, cookie, URL, database o log applicativi. Il frontend recupera il catalogo e, per generare il PDF, i caratteri locali del sito. Nessuna richiesta contiene i dati del preventivo. Non è incluso alcun servizio di analisi o tracciamento. I normali servizi di hosting e database gestiscono i propri log delle richieste HTTP.

«Scarica il preventivo» genera un PDF A4 sul dispositivo con logo, data italiana, anteprima indicativa, configurazione, misure, voci di costo e IVA separata. I caratteri del documento sono caricati dalla stessa origine del sito. La libreria PDF viene caricata soltanto quando serve. Il documento conserva la configurazione presente al momento del clic e resta chiaro anche se il sito è in tema scuro. I nomi lunghi vanno a capo e, se necessario, il riepilogo continua su una seconda pagina. Il pulsante «Stampa» e la stampa da tastiera usano un modello A4 dedicato, coerente con il PDF scaricabile, invece del riepilogo della pagina web. La data viene aggiornata quando si apre la stampa.

La generazione PDF e la stampa non caricano misure o scelte a servizi esterni. Il disegno è illustrativo: quantità e superfici dei ripiani seguono la configurazione, senza simulare portata o fattibilità costruttiva. Struttura e ripiani sono esposti separatamente in sito, PDF e stampa.

## Fonti

Requisiti: `01_COMMESSA_Legno_e_Co_Preventivatore.docx`. Prezzi e casi: `listino_preventivatore_LegnoCo.xlsx`. La nota estranea in `Listino!A60` non è stata seguita. Nessuna bozza di un'altra IA era presente.

Riferimenti tecnici: [Vite](https://vite.dev/guide/), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [chiavi pubblicabili Supabase](https://supabase.com/docs/guides/getting-started/api-keys), [Vite su Vercel](https://vercel.com/docs/frameworks/frontend/vite).
