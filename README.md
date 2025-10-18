# ChatApp RAG (Backend + Frontend) — with optional streaming

An end-to-end Retrieval-Augmented Generation (RAG) sample that lets you ingest your own PDFs and chat with them. Now supports both standard (non‑streaming) replies and Server‑Sent Events (SSE) streaming. The project is split into two apps:

- `backend/` – Node/TypeScript Express API that ingests PDFs, stores embeddings in a local LanceDB vector store, performs semantic search, and calls OpenAI for answers.
- `frontend/` – React TypeScript SPA that calls the backend to ingest data, search, and chat.


---

## Architecture (high-level)

1) Ingestion
- PDFs are read and converted to per-page text using `pdf-parse` (pagerender).
- Each page is chunked into overlapping segments using LangChain's `RecursiveCharacterTextSplitter` (default: 800 chars, 120 overlap).
- Embeddings (OpenAI `text-embedding-3-small`) are generated for chunks and stored in LanceDB together with metadata (`documentId`, `pageNumber`, `text`).

2) Retrieval
- A query is embedded and compared with chunk vectors using LanceDB ANN search.
- Optional filter by `documentId`.

3) Generation
- Top‑k chunk texts are concatenated into a context prompt.
- OpenAI/GitHub Models chat model (default: `gpt-4o-mini`) produces a grounded answer.
- The system prompt asks the model to append XML citations per fact using the context’s filename/page.
- Optionally stream tokens over SSE so the UI renders incremental output.

---

## Backend

### Tech
- Node 18+ / TypeScript
- Express
- OpenAI SDK
- LanceDB (local vector DB)
- pdf-parse (pagerender per-page text)
- LangChain text splitter

### Important paths
- Data (PDFs): `backend/src/data/`
- Vector store: `backend/src/lancedb/`
- Postman collection: `backend/ChatApp_Backend.postman_collection.json`

### Environment
Create `backend/.env` (or export environment variables):

```
API_KEY=sk-...
# Optional overrides
EMBEDDING_MODEL=text-embedding-3-small
BASE_URL=...
CHAT_MODEL=gpt-4o-mini
PDF_DIR=./src/data
LANCEDB_DIR=./src/lancedb
PORT=4000
```

Notes:
- `PDF_DIR` and `LANCEDB_DIR` default to in-repo paths and are resolved to absolute at runtime.
- Use absolute paths in env to avoid ambiguity.

### Install & run

```
cd backend
npm install
npm run dev
```

The server starts (default `:4000`).

### API overview

- Health
  - `GET /health` → `{ ok: true }`

- Ingest
  - `POST /api/ingest/pdf-directory`
  - Ingests PDFs from `PDF_DIR` (server-side configured). You don’t send a path from the client for security.

- Search
  - `GET /api/search?q=...&documentId=...&max=5`
  - Returns top-k chunks with metadata and distances. If `documentId` is provided, results are filtered client-side (compatible with multiple LanceDB versions).

- Chat (RAG)
  - `POST /api/chat`
  - Body: `{ question?: string, messages?: Message[], documentId?: string, maxResults?: number }`
  - Notes: You can pass a single `question` or a rolling `messages[]` history. If `question` is omitted, the latest user message in `messages[]` is used.
  - Returns: `{ answer: string }`
  - The system prompt instructs the model to append XML citations per fact, e.g.:
    - `<citation filename='Solar_Charger.pdf' page_number='6'>short quote</citation>`

- Chat (RAG) — Streaming (SSE)
  - `POST /api/chat/stream`
  - Body: `{ question?: string, messages?: Message[], documentId?: string, maxResults?: number }`
  - Response: `text/event-stream` where each event is `data: { delta?: string, done?: boolean, full?: string }`
  - The final event includes `{ done: true, full }`. Frontend typically accumulates `delta` tokens and appends `full` as one assistant turn.

### Tool-choice (function calling) mode

This variant also supports a tool-choice flow where the model decides whether to invoke a `search` tool first:

- When enabled: The model calls `search` only if it believes the user’s question is related to the ingested documents; then it grounds the answer with citations. If unrelated, it answers briefly and emits no citations.
- When disabled: The backend always runs direct RAG before generating.

How to enable/disable:
- Non-streaming route uses direct RAG or tool-choice depending on the code path in `routes/chat.ts`.
- Streaming route can use the same logic but streams tokens after the decision. In `routes/chat.ts`, call the streaming helper that wires `AskService.askWithToolChoice(...)` when tool-choice is desired, or use `ask.ask(...)` for direct RAG.

When tool-calling triggers, the backend logs a line similar to:

```
[AskService] Function calling triggered: [ 'search' ]
```
### Ingestion details
- Per-page extraction with `pdf-parse` pagerender (more reliable than splitting on form-feed).
- LangChain splitter: chunkSize 800, overlap 120 (adjust to taste).
- Re-ingest instructions:
  - Stop the backend.
  - Delete the vector store folder: `rm -rf backend/src/lancedb`.
  - Start the backend and `POST /api/ingest/pdf-directory` again.

---

## Frontend

### Tech
- React + TypeScript (Create React App / Vite‑like dev experience)
- Calls the backend’s endpoints for ingest, search, and chat.
- Optional streaming mode with a UI switch.

### Configure & run

```
cd frontend
npm install
npm start
```

If your backend runs on a different origin/port, configure the base URL in `frontend/src/api.ts` (or via an env like `REACT_APP_API_BASE`).

### Typical flow
1) Start backend, then frontend.
2) Ingest PDFs (call `POST /api/ingest/pdf-directory`).
3) Try search (`GET /api/search?q=...`).
4) Ask a question (`POST /api/chat`) or toggle streaming and use `POST /api/chat/stream`.

### Streaming specifics (frontend)
- Streaming client: `frontend/src/services/stream.ts` (`streamChat(...)`) reads the SSE stream via `fetch` + `ReadableStream`.
- Toggle: The Ask panel includes a “Streaming” switch. When on, the app calls `streamChat`; when off, it calls the regular chat API.
- History window: Only the last 6 messages are sent to the backend to keep prompts compact; you can adjust this as needed.

### Optional: Use Vercel AI SDK to simplify streaming
If you prefer higher-level utilities for streaming and chat state, you can adopt the Vercel AI SDK.

- Install (backend and/or frontend):
  - `npm i ai @ai-sdk/openai`

- Backend idea (Express):
  - Use `streamText` with an `openai(config.chatModel)` model to generate a stream and pipe it as SSE. You would still build your system+history messages and context (as we do), but `streamText` reduces boilerplate when chunking and sending tokens.

- Frontend idea (React):
  - Keep the current `stream.ts` (already works), or try `ai/react` hooks like `useChat` to manage input, messages, and streaming automatically. You may need to align the endpoint response with AI SDK helpers if you choose its built-in handlers.

Note: AI SDK is optional. The included SSE implementation is production‑ready; AI SDK can just reduce code and provide useful abstractions.


---

## License

MIT (or your preferred license)


