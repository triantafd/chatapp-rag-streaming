import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

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

export default router;

