import { Router } from 'express';
import { DataIngestor } from '../services/ingestion/DataIngestor';
import { EmbeddingService } from '../services/EmbeddingService';
import { config } from '../config';
import { PDFDirectorySource } from '../services/ingestion/PDFDirectorySource';
import { getAIClient } from '../services/aiClient';

const router = Router();

router.post('/pdf-directory', async (req, res) => {
  try {
    const dir = config.pdfDir;
    const client = getAIClient();
    const embedder = new EmbeddingService(client, config.embeddingModel);
    const ingestor = new DataIngestor(embedder);
    await ingestor.ingest(new PDFDirectorySource(dir));
    res.json({ ok: true, dir });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;






