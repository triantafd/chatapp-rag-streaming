# chatapp-rag-mcp

An [MCP](https://modelcontextprotocol.io) server that exposes the ChatApp RAG backend as tools, so Claude Code, Claude Desktop, or any MCP client can search and question your ingested PDFs directly.

It is a thin translation layer: every tool calls the existing Express API in `../backend`. No RAG logic lives here.

```
MCP client (Claude Code / Desktop)  ──stdio──▶  mcp-server  ──HTTP──▶  backend :4000  ──▶  LanceDB + OpenAI
```

## Tools

| Tool | Arguments | Backend call | Notes |
|---|---|---|---|
| `search_documents` | `query`, `documentId?`, `max?` (1–20, default 5) | `GET /api/search` | Raw matching chunks with file, page, distance. No LLM. |
| `ask_question` | `question`, `documentId?` | `POST /api/chat` | Grounded answer from the backend's LLM; XML citations are turned into a `Sources:` list. |
| `list_documents` | — | `GET /api/documents/ingested` + `GET /api/documents` | What is actually in the vector store, plus PDFs in the folder not ingested yet. |
| `ingest_pdf_directory` | — | `POST /api/ingest/pdf-directory` | Indexes the backend's `PDF_DIR`. Calls the embedding API. Not read-only. |

`documentId` is the PDF file name, e.g. `Solar_Charger.pdf` — `list_documents` shows the valid values.

## Setup

Requires Node 18+ and a running backend (see the root README).

```bash
# 1. start the backend (separate terminal)
cd backend && npm run dev

# 2. build the MCP server
cd mcp-server
npm install
npm run build
```

Configuration (environment variable):

| Variable | Default |
|---|---|
| `CHATAPP_API_URL` | `http://localhost:4000/api` |

## Use with Claude Code (Linux, macOS, Windows)

```bash
claude mcp add chatapp-rag \
  -e CHATAPP_API_URL=http://localhost:4000/api \
  -- node /absolute/path/to/chatapp-rag-streaming/mcp-server/dist/index.js
```

- Default scope is `local` (only you, only this project). Use `-s user` for all projects, or `-s project` to write a shareable `.mcp.json` into the repo.
- Check it: `claude mcp list` should show `chatapp-rag: ... ✓ Connected`, or run `/mcp` inside a session.
- Remove it: `claude mcp remove chatapp-rag`.

One-off run without changing your config:

```bash
claude -p "Search my PDFs for the solar charger specs" \
  --mcp-config ./mcp.json --strict-mcp-config --allowedTools "mcp__chatapp-rag"
```

where `mcp.json` uses the same shape as the Claude Desktop config below.

## Use with Claude Desktop (macOS, Windows)

Claude Desktop is not available on Linux — use Claude Code there.

Edit the config file (Claude Desktop → Settings → Developer → Edit Config):

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "chatapp-rag": {
      "command": "node",
      "args": ["/absolute/path/to/chatapp-rag-streaming/mcp-server/dist/index.js"],
      "env": { "CHATAPP_API_URL": "http://localhost:4000/api" }
    }
  }
}
```

Use an absolute path (on Windows, escape backslashes: `C:\\Users\\...`). Fully quit and restart Claude Desktop; the tools appear under the tools (🔨) menu.

## Demo

Prompt given to Claude Code with this server connected:

> Which documents are ingested in my RAG app? Then search my PDFs for the solar charger's specifications and give me a short summary with page citations.

Tool calls Claude made:

```
mcp__chatapp-rag__list_documents {}
mcp__chatapp-rag__search_documents {"query":"solar charger specifications (output voltage, current, wattage, battery capacity, panel efficiency)","max":10}
```

Claude's answer (abridged):

> Your RAG app has **2 ingested documents**: `Example_Emergency_Survival_Kit.pdf` (87 chunks) and `Solar_Charger.pdf` (66 chunks).
>
> **SunShift 100W Solar Charger (Ecovolt) — specifications**
>
> **Electrical** (p. 9) — Max power 100W · 18V / 5.55A at Pmax · Open-circuit 21.6V · Short-circuit 6.11A
> **Physical** (p. 9) — 26.2 × 20.1 × 1.4 in · 6.2 lbs · Monocrystalline
> **Performance** (p. 9) — Fast charging · Weather resistant · −40°F to 185°F · USB 5V/2.4A (3.5A max total)
> **In the box** (p. 9) — Charger, 10 ft Anderson cable, 10 ft USB cable, user manual

Other prompts to try:

- "Ask my documents what should be in an emergency survival kit for water."
- "Search only Solar_Charger.pdf for safety warnings."
- "Are any of my PDFs not ingested yet? If so, ingest them."

## Debugging

- **MCP Inspector** (browser UI to call tools by hand): `npm run inspector`
- **Backend not running** → tools return `Cannot reach the ChatApp backend at … (ECONNREFUSED)`.
- **Logs** go to stderr (stdout is the MCP protocol channel — never `console.log` in this server). Claude Code: `claude --debug`; Claude Desktop: `~/Library/Logs/Claude/mcp-server-chatapp-rag.log` (macOS) or `%APPDATA%\Claude\logs\` (Windows).
- **Duplicate search results** (same page repeated): the vector store holds the same chunks more than once. Reset with `rm -rf backend/src/lancedb` (backend stopped), then run `ingest_pdf_directory` once.
