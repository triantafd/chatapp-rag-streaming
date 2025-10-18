/** @format */

import { EmbeddingService } from "./EmbeddingService";
import { getTables } from "./LanceDb";

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const normB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return dot / (normA * normB + 1e-8);
}

export class SemanticSearch {
  constructor(private embedder: EmbeddingService) {}

  async search(
    text: string,
    documentIdFilter?: string,
    maxResults: number = 5
  ) {
    const { chunks } = await getTables();
    const queryVec = await this.embedder.embedOne(text);

    // Fetch more candidates and filter client-side for robustness across LanceDB versions
    const candidates = await (chunks as any)
      .search(new Float32Array(queryVec))
      .limit(Math.max(50, maxResults))
      .toArray();
    const filterId = documentIdFilter ? String(documentIdFilter).trim() : undefined;
    const rows = (filterId
      ? (candidates as any[]).filter((r: any) => r.documentId === filterId)
      : candidates
    ).slice(0, maxResults);

    return rows.map((r: any) => ({
      key: r.key,
      documentId: r.documentId,
      pageNumber: r.pageNumber,
      text: r.text,
      vector: r.vector,
      score: r._distance,
    }));
  }
}
