import path from 'path';

const pdfDirRaw = process.env.PDF_DIR || './src/data';
const pdfDirAbs = path.isAbsolute(pdfDirRaw) ? pdfDirRaw : path.resolve(process.cwd(), pdfDirRaw);
const lanceDirRaw = process.env.LANCEDB_DIR || './src/lancedb';
const lanceDirAbs = path.isAbsolute(lanceDirRaw) ? lanceDirRaw : path.resolve(process.cwd(), lanceDirRaw);
const apiKey: string | undefined = process.env.API_KEY;
const baseURL: string | undefined = process.env.BASE_URL;

export const config = {
  apiKey,
  baseURL,
  embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  chatModel: process.env.CHAT_MODEL || 'gpt-4o-mini',
  pdfDir: pdfDirAbs,
  lanceDir: lanceDirAbs,
};

