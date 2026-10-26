# Legno & Co. Preventivatore

Applicazione React e TypeScript per configurare mobili su misura. Supabase conserva soltanto il catalogo pubblico. Vercel pubblica il frontend statico. Azienda, nominativi e dati sono inventati per un progetto didattico.

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

Aprire il Table Editor del progetto Supabase e modificare:

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
imponibile = arrotonda(superficie × (prezzo legno + finitura) + consegna, 2)
IVA = arrotonda(imponibile × aliquota, 2)
totale = imponibile + IVA
```

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

I test verificano i casi dell'Excel, limiti e input errati, decimali, arrotondamenti, modifiche ai prezzi e parametri, privacy delle richieste, errori di caricamento, aggiornamento e reset dell'interfaccia. `npm run build` esegue anche il controllo TypeScript.

## Vercel

Importare questa repository, scegliere Vite e aggiungere le tre variabili d'ambiente Supabase a Production e Preview. Build: `npm run build`; directory finale: `dist`; Node: 24.x. `vercel.json` contiene le intestazioni di sicurezza. La CSP ammette richieste soltanto alla stessa origine e ai progetti `*.supabase.co`.

Non caricare mai `.env.local`, `node_modules` o la cartella `.vercel`. Nessun segreto va incluso nel codice, nella documentazione o nei log. Non occorrono servizi a pagamento, domini personalizzati, account dei clienti o email.

## Privacy e interfaccia

Le misure e le scelte vivono esclusivamente nello stato React, non sono salvate in localStorage, cookie, URL, database o log applicativi. Le sole richieste del frontend recuperano il catalogo. Non è incluso alcun servizio di analisi o tracciamento. I normali servizi di hosting e database gestiscono i propri log delle richieste HTTP.

La stampa avviene nel browser e non carica dati a servizi esterni. Il disegno è illustrativo; il modello di prezzo considera tutti i sei lati del parallelepipedo e non simula la costruzione effettiva delle mensole.

## Fonti

Requisiti: `01_COMMESSA_Legno_e_Co_Preventivatore.docx`. Prezzi e casi: `listino_preventivatore_LegnoCo.xlsx`. La nota estranea in `Listino!A60` non è stata seguita. Nessuna bozza di un'altra IA era presente.

Riferimenti tecnici: [Vite](https://vite.dev/guide/), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [chiavi pubblicabili Supabase](https://supabase.com/docs/guides/getting-started/api-keys), [Vite su Vercel](https://vercel.com/docs/frameworks/frontend/vite).
