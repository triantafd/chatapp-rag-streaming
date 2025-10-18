import { Router } from 'express';
import { OpenAI } from 'openai';
import { EmbeddingService } from '../services/EmbeddingService';
import { AskService } from '../services/AskService';
import { AskServiceStream } from '../services/AskServiceStream';
import { config } from '../config';
import { getAIClient } from '../services/aiClient';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { question, documentId, maxResults, messages } = req.body as {
      question?: string; documentId?: string; maxResults?: number;
      messages?: { role: 'user'|'assistant'|'system'; content: string }[];
    };
    if (!question && (!messages || messages.length === 0)) return res.status(400).json({ error: 'question or messages[] required' });
    const latestUserQuestion = question ?? [...(messages||[])].reverse().find(m => m.role === 'user')?.content ?? '';
    if (!latestUserQuestion) return res.status(400).json({ error: 'missing user question' });
    const client = getAIClient();
    const embedder = new EmbeddingService(client, config.embeddingModel);
    const ask = new AskService(embedder, client, config.chatModel);
    //const { answer , hits} = await ask.ask(latestUserQuestion, documentId, maxResults ?? 6, messages);
    const { answer , hits} = await ask.askWithToolChoice(latestUserQuestion, documentId, maxResults ?? 6, messages);
    res.json({ answer, citations:hits });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;



// Streaming (SSE)
router.post('/stream', async (req, res) => {
  try {
    const { question, documentId, maxResults, messages } = req.body as {
      question?: string; documentId?: string; maxResults?: number;
      messages?: { role: 'user'|'assistant'|'system'; content: string }[];
    };
    if (!question && (!messages || messages.length === 0)) {
      res.status(400).end();
      return;
    }
    const latestUserQuestion = question ?? [...(messages||[])].reverse().find(m => m.role === 'user')?.content ?? '';
    if (!latestUserQuestion) {
      res.status(400).end();
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const client = getAIClient();
    const embedder = new EmbeddingService(client, config.embeddingModel);
    const streamSvc = new AskServiceStream(embedder, client, config.chatModel);
    const { llmMessages, hits } = await streamSvc.buildMessages(latestUserQuestion, documentId, maxResults ?? 6, messages);

    const stream = await client.chat.completions.create({
      model: config.chatModel,
      messages: llmMessages,
      temperature: 0.2,
      stream: true,
    });

    let full = '';
    for await (const chunk of stream) {
      const delta = (chunk as any)?.choices?.[0]?.delta?.content ?? '';
      if (delta) {
        full += delta;
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }
    res.write(`data: ${JSON.stringify({ done: true, full, citations: hits })}\n\n`);
    res.end();
  } catch (e: any) {
    try {
      res.write(`data: ${JSON.stringify({ error: e?.message || String(e) })}\n\n`);
      res.end();
    } catch {
      // ignore
    }
  }
});
