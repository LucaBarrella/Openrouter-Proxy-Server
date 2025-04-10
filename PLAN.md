# Piano di Modifica per Gestione Rate Limit (Logica OR)

## Obiettivo

Modificare la logica di rotazione delle chiavi API in `Openrouter-Proxy-Server` affinché la rotazione avvenga se si verifica **almeno una** delle seguenti condizioni:

1.  La risposta API ha uno status code HTTP `429`.
2.  Il messaggio di errore nella risposta API contiene la stringa "Rate limit" (case-insensitive).

## Passaggi Dettagliati

1.  **Modificare `server.js`:**
    *   Nelle sezioni `catch` delle chiamate API OpenRouter (attorno alle linee 130 e 194), passare a `keyManager.markKeyError` sia l'oggetto `error` sia i dati della risposta dell'errore (`error.response?.data`).
    *   Esempio modifica chiamata:
        ```javascript
        const isRateLimit = await keyManager.markKeyError(error, error.response?.data);
        ```

2.  **Modificare `services/KeyManager.js`:**
    *   **Aggiornare la firma del metodo `markKeyError`** per accettare `responseData`:
        ```javascript
        async markKeyError(error, responseData) {
        ```
    *   **Modificare la logica di rilevamento (Logica OR):**
        *   Estrarre `statusCode = error.response?.status` e `errorMessage = responseData?.error?.message || ''`.
        *   Verificare la condizione: `isTriggerCondition = (statusCode === 429 || errorMessage.toLowerCase().includes('rate limit'))`.
        *   **Se `isTriggerCondition` è vera:**
            *   Impostare `rateLimitResetAt`:
                *   Se `statusCode === 429`, usare `error.response.headers['x-ratelimit-reset']` o un default (es. 60s).
                *   Se `statusCode !== 429` (ma il messaggio matcha), usare un default (es. 60s).
            *   Loggare l'evento (es. 'Rate Limit Condition Met (OR)').
            *   Impostare `this.currentKey = null` per forzare la rotazione.
            *   Ritornare `true`.
        *   **Se `isTriggerCondition` è falsa:**
            *   Incrementare `this.currentKey.failureCount`.
            *   Se `failureCount` supera la soglia, disattivare la chiave (`isActive = false`, loggare, `this.currentKey = null`).
            *   Ritornare `false`.

## Diagramma del Piano (Mermaid)

```mermaid
graph TD
    A[Inizio: Problema Rate Limit Specifico] --> B{Analisi Codice};
    B --> C[Identificato `KeyManager.js#markKeyError` e `server.js`];
    C --> D{Piano di Modifica (Logica OR)};
    D --> E[1. Modifica Chiamate in `server.js`];
    D --> F[2. Modifica `KeyManager.js`];
    F --> G[Aggiorna Firma `markKeyError`];
    F --> H[Modifica Logica Rilevamento Rate Limit (OR)];
    H --> I{Condizione: Status 429 OR Messaggio "Rate limit"?};
    I -- Sì --> K[Esegui Logica Rate Limit (Cooldown, Log, Rotazione)];
    I -- No --> L[Esegui Logica Errore Generico];
    E --> M{Approvazione Utente};
    G --> M;
    K --> M;
    L --> M;
    M -- Sì --> N[Salva Piano in MD? (Opzionale)];
    N -- Sì/No --> O[Passa a Modalità Code per Implementazione];
    O --> P[Implementa Modifiche];
    P --> Q[Test e Verifica];
    Q --> R[Fine];
    M -- No --> S[Revisione Piano];
    S --> D;

    style M fill:#f9f,stroke:#333,stroke-width:2px
    style O fill:#ccf,stroke:#333,stroke-width:2px
```

## Prossimo Passo

Passare alla modalità "Code" per implementare le modifiche descritte in `server.js` e `services/KeyManager.js`.