import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pino from 'pino';
import pinoPretty from 'pino-pretty';
import ingestRouter from './routes/ingest';
import searchRouter from './routes/search';
import chatRouter from './routes/chat';
// @ts-ignore - local route module
import documentsRouter from './routes/documents';
import { config } from './config';

const logger = pino(pinoPretty({ translateTime: true }));

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// LanceDB is embedded; no startup connection required. Ensure tables exist lazily.

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/ingest', ingestRouter);
app.use('/api/search', searchRouter);
app.use('/api/chat', chatRouter);
app.use('/api/documents', documentsRouter);
// Serve PDFs statically so the frontend can open them with #page=N
app.use('/pdfs', express.static(config.pdfDir));

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => logger.info(`Backend listening on :${port}`));






