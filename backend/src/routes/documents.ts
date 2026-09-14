import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { getTables } from '../services/LanceDb';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const dir = config.pdfDir;
    const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    const pdfs = files.filter(f => f.toLowerCase().endsWith('.pdf'));
    res.json({ documents: pdfs });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// Documents actually present in the vector store (i.e. searchable), unlike `/`
// which lists PDFs in the folder whether or not they have been ingested.
router.get('/ingested', async (_req, res) => {
  try {
    const { docs, chunks } = await getTables();
    const rows = (await docs.query().toArray()) as { documentId: string; documentVersion: string }[];
    // Re-ingesting a modified PDF can leave an older row behind; keep the newest version.
    const latest = new Map<string, string>();
    for (const r of rows) {
      const prev = latest.get(r.documentId);
      if (!prev || r.documentVersion > prev) latest.set(r.documentId, r.documentVersion);
    }
    const documents = await Promise.all(
      [...latest].map(async ([documentId, documentVersion]) => ({
        documentId,
        documentVersion,
        // Backticks quote the column name; in LanceDB SQL "double quotes" would be a string literal.
        chunkCount: await chunks.countRows(`\`documentId\` = '${documentId.replace(/'/g, "''")}'`),
      }))
    );
    documents.sort((a, b) => a.documentId.localeCompare(b.documentId));
    res.json({ documents });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

export default router;
