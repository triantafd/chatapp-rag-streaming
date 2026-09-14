#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// stdout carries the MCP protocol, so all logging must go to stderr.
const log = (...args: unknown[]) => console.error('[chatapp-rag-mcp]', ...args);

const API_URL = (process.env.CHATAPP_API_URL ?? 'http://localhost:4000/api').replace(/\/+$/, '');

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

const text = (t: string): ToolResult => ({ content: [{ type: 'text', text: t }] });
const errorResult = (t: string): ToolResult => ({ ...text(t), isError: true });

async function callApi<T>(path: string, init: RequestInit = {}, timeoutMs = 120_000): Promise<T> {
  const url = `${API_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e: any) {
    if (e?.name === 'TimeoutError') throw new Error(`Backend request timed out after ${timeoutMs / 1000}s: ${url}`);
    throw new Error(
      `Cannot reach the ChatApp backend at ${API_URL} (${e?.cause?.code ?? e?.message}). ` +
        'Start it with `cd backend && npm run dev`, or set CHATAPP_API_URL.'
    );
  }
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Backend ${res.status} on ${path}: ${body?.error ?? res.statusText}`);
  return body as T;
}

// Wraps a handler so backend failures come back as MCP tool errors instead of protocol errors.
function safe<A>(fn: (args: A) => Promise<ToolResult>) {
  return async (args: A): Promise<ToolResult> => {
    try {
      return await fn(args);
    } catch (e: any) {
      log('tool error:', e?.message ?? e);
      return errorResult(e?.message ?? String(e));
    }
  };
}

type SearchHit = { documentId: string; pageNumber: number; text: string; score?: number };
type IngestedDoc = { documentId: string; documentVersion: string; chunkCount: number };

const CITATION_RE = /<citation\s+filename='([^']+)'\s+page_number='(\d+)'[^>]*>([^<]*)<\/citation>/g;

// The backend's model appends XML citations; turn them into a readable source list.
function formatAnswer(answer: string): string {
  const sources: string[] = [];
  for (const m of answer.matchAll(CITATION_RE)) {
    const quote = m[3].trim();
    sources.push(`- ${m[1]} p.${m[2]}${quote ? ` — "${quote}"` : ''}`);
  }
  const body = answer.replace(CITATION_RE, '').trim();
  if (!sources.length) return `${body}\n\n(No sources cited — the backend found no relevant document content.)`;
  return `${body}\n\nSources:\n${[...new Set(sources)].join('\n')}`;
}

async function describeDocuments(): Promise<string> {
  const [{ documents: ingested }, { documents: inFolder }] = await Promise.all([
    callApi<{ documents: IngestedDoc[] }>('/documents/ingested'),
    callApi<{ documents: string[] }>('/documents'),
  ]);
  const lines: string[] = [];
  if (ingested.length) {
    lines.push(`Ingested documents (${ingested.length}) — use these names as documentId:`);
    for (const d of ingested) lines.push(`- ${d.documentId} (${d.chunkCount} chunks, file modified ${d.documentVersion})`);
  } else {
    lines.push('No documents are ingested yet.');
  }
  const ingestedIds = new Set(ingested.map((d) => d.documentId));
  const pending = inFolder.filter((f) => !ingestedIds.has(f));
  if (pending.length) {
    lines.push('', `PDFs in the folder but not ingested (run ingest_pdf_directory): ${pending.join(', ')}`);
  }
  return lines.join('\n');
}

const server = new McpServer(
  { name: 'chatapp-rag', version: '1.0.0' },
  {
    instructions:
      'Tools for a local RAG app over the user\'s PDFs. Call list_documents to see what is searchable. ' +
      'Use ask_question for a grounded answer with citations, or search_documents to read the raw matching passages. ' +
      'If nothing is ingested, ingest_pdf_directory indexes the PDFs in the backend folder.',
  }
);

server.registerTool(
  'search_documents',
  {
    title: 'Search documents',
    description:
      'Semantic (vector) search over the ingested PDFs. Returns the most similar text chunks with file name, page number and distance (lower = closer). No LLM answer is generated.',
    inputSchema: {
      query: z.string().min(1).describe('What to search for, in natural language'),
      documentId: z.string().optional().describe('Limit to one document, e.g. "Solar_Charger.pdf" (see list_documents)'),
      max: z.number().int().min(1).max(20).optional().describe('Maximum number of chunks to return (default 5)'),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  safe(async ({ query, documentId, max }) => {
    const params = new URLSearchParams({ q: query, max: String(max ?? 5) });
    if (documentId) params.set('documentId', documentId);
    const { results } = await callApi<{ results: SearchHit[] }>(`/search?${params}`);
    if (!results.length) {
      return text(`No matching chunks for "${query}"${documentId ? ` in ${documentId}` : ''}. Check list_documents — the document may not be ingested.`);
    }
    const blocks = results.map(
      (r, i) =>
        `[${i + 1}] ${r.documentId} p.${r.pageNumber}${typeof r.score === 'number' ? ` (distance ${r.score.toFixed(3)})` : ''}\n${r.text}`
    );
    return text(blocks.join('\n\n'));
  })
);

server.registerTool(
  'ask_question',
  {
    title: 'Ask a question',
    description:
      'Ask the RAG app a question. The backend retrieves relevant chunks from the ingested PDFs and its own LLM writes a grounded answer, returned with a list of cited sources (file and page).',
    inputSchema: {
      question: z.string().min(1).describe('The question to answer from the documents'),
      documentId: z.string().optional().describe('Limit retrieval to one document (see list_documents)'),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  safe(async ({ question, documentId }) => {
    // /api/chat only reads messages[], so send the question as a user message.
    const { answer } = await callApi<{ answer: string }>('/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: question }], documentId, maxResults: 6 }),
    });
    if (!answer) return errorResult('The backend returned an empty answer.');
    return text(formatAnswer(answer));
  })
);

server.registerTool(
  'list_documents',
  {
    title: 'List documents',
    description:
      'List the documents currently ingested in the vector store (these are searchable), plus any PDFs in the folder that are not ingested yet.',
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  safe(async () => text(await describeDocuments()))
);

server.registerTool(
  'ingest_pdf_directory',
  {
    title: 'Ingest PDF directory',
    description:
      'Index the PDFs in the backend\'s configured folder into the vector store. Incremental: only new or modified PDFs are embedded (this calls the embedding API), and PDFs removed from the folder are dropped from the index. Can take a while for large files.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  safe(async () => {
    const r = await callApi<{
      ok: boolean;
      dir: string;
      added?: string[];
      updated?: string[];
      removed?: string[];
      unchanged?: number;
      chunksEmbedded?: number;
    }>('/ingest/pdf-directory', { method: 'POST', body: '{}' }, 600_000);
    const names = (label: string, ids?: string[]) => (ids?.length ? `${label}: ${ids.join(', ')}` : `${label}: none`);
    const summary = [
      `Ingestion finished for ${r.dir}.`,
      names('Added', r.added),
      names('Updated', r.updated),
      names('Removed', r.removed),
      `Unchanged: ${r.unchanged ?? '?'} · Chunks embedded: ${r.chunksEmbedded ?? '?'}`,
    ].join('\n');
    return text(`${summary}\n\n${await describeDocuments()}`);
  })
);

async function main() {
  await server.connect(new StdioServerTransport());
  log(`ready — backend ${API_URL}`);
}

main().catch((e) => {
  log('fatal:', e);
  process.exit(1);
});
