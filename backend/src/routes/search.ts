/** @format */

import { Router } from "express";
import { EmbeddingService } from "../services/EmbeddingService";
import { SemanticSearch } from "../services/SemanticSearch";
import { config } from "../config";
import { getAIClient } from "../services/aiClient";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const text = String(req.query.q ?? "");
    const documentId = req.query.documentId
      ? String(req.query.documentId)
      : undefined;
    const max = req.query.max ? Number(req.query.max) : 5;
    if (!text) return res.status(400).json({ error: "q is required" });
    const client = getAIClient();
    const embedder = new EmbeddingService(client, config.embeddingModel);
    const search = new SemanticSearch(embedder);
    const results = await search.search(text, documentId, max);
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
