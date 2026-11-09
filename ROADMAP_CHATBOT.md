# Roadmap chatbot Legno & Co.

Questo file raccoglie le integrazioni da completare senza modificare `dispense/`.

## Modello 3D e configuratore

- Quando il chatbot cambia prodotto, legno, finitura o misure, aggiornare anche il modello 3D.
- Mostrare nel modello il prodotto selezionato, non solo l'anteprima generica del mobile.
- Sincronizzare ripiani, proporzioni, colore e finitura con i dati del carrello.
- Se il chatbot rimuove o svuota il carrello, riportare il configuratore allo stato coerente.
- Evidenziare nel configuratore quando una modifica arriva dal chatbot.

## Carrello Blocco 4

- Mostrare nel sito il riepilogo delle righe aggiunte dal chatbot.
- Permettere modifica, rimozione e svuotamento con conferma.
- Collegare il carrello al preventivo deterministico e alla consegna scelta.
- Mantenere il carrello nella sessione privata del visitatore.

## Blocchi successivi

- Blocco 5: ricerca FAQ e risposte con fonte documentale.
- Blocco 6: richiesta preventivo via endpoint server, con validazione dei dati.
- Blocco 7: memoria, log dei consumi e tracciamento delle richieste senza esporre segreti.
- Blocco 8: analisi e report su domande, prodotti richiesti, preventivi e conversioni.

## Verifiche obbligatorie

- Build TypeScript e Vite.
- Test Supabase di RLS, RPC, memoria, FAQ e carrello.
- Test reale degli endpoint in produzione.
- Verifica browser desktop e mobile.
- `dispense/` sempre ignorata da Git e assente dal deploy.
