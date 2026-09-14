/** @format */

import type { Table } from "@lancedb/lancedb";
import { EmbeddingService } from "../EmbeddingService";
import { getTables, LanceDocument } from "../LanceDb";
import { IIngestionSource } from "./IIngestionSource";

export type IngestResult = {
  added: string[];
  updated: string[];
  removed: string[];
  unchanged: number;
  chunksEmbedded: number;
};

// LanceDB SQL: identifiers are quoted with backticks ("double quotes" are string
// literals, so such a filter never matches); single quotes in values are doubled.
const eq = (column: string, value: string) =>
  `\`${column}\` = '${value.replace(/'/g, "''")}'`;

export class DataIngestor {
  constructor(private embedder: EmbeddingService) {}

  async ingest(source: IIngestionSource): Promise<IngestResult> {
    const { docs: docsTable, chunks: chunksTable } = await getTables();
    const existing = (await docsTable
      .query()
      .where(eq("sourceId", source.sourceId))
      .toArray()) as LanceDocument[];

    const result: IngestResult = { added: [], updated: [], removed: [], unchanged: 0, chunksEmbedded: 0 };
    const existingIds = new Set(existing.map((d) => d.documentId));

    // deletions
    const deleted = await source.getDeletedDocuments(existing);
    for (const documentId of new Set(deleted.map((d) => d.documentId))) {
      await chunksTable.delete(eq("documentId", documentId));
      await docsTable.delete(eq("documentId", documentId));
      existingIds.delete(documentId);
      result.removed.push(documentId);
    }

    // new/modified
    const modified = await source.getNewOrModifiedDocuments(existing);
    for (const doc of modified) {
      result.chunksEmbedded += await this.reingestOne(doc, source, docsTable, chunksTable);
      (existingIds.has(doc.documentId) ? result.updated : result.added).push(doc.documentId);
    }
    result.unchanged = existingIds.size - result.updated.length;
    return result;
  }

  private async reingestOne(
    doc: LanceDocument,
    source: IIngestionSource,
    docsTable: Table,
    chunksTable: Table
  ): Promise<number> {
    // 1) Build and embed fresh chunks before touching the tables, so a parse or
    //    embedding failure leaves the previous version of the document intact.
    const newChunks = await source.createChunksForDocument(doc);
    const withVectors: Record<string, unknown>[] = [];
    const batchSize = 64;
    for (let i = 0; i < newChunks.length; i += batchSize) {
      const slice = newChunks.slice(i, i + batchSize);
      const vecs = await this.embedder.embed(slice.map((s) => s.text));
      slice.forEach((s, idx) =>
        withVectors.push({
          key: s.key,
          documentId: s.documentId,
          pageNumber: s.pageNumber,
          text: s.text,
          vector: vecs[idx],
        })
      );
    }
    // 2) Replace old chunks and any old document rows for this document
    await chunksTable.delete(eq("documentId", doc.documentId));
    await docsTable.delete(eq("documentId", doc.documentId));
    if (withVectors.length) await chunksTable.add(withVectors);
    // 3) Write the document row last: it marks this version as fully ingested,
    //    so an interrupted run is retried next time instead of looking up to date.
    await docsTable.add([
      {
        key: doc.key,
        sourceId: doc.sourceId,
        documentId: doc.documentId,
        documentVersion: doc.documentVersion,
      },
    ]);
    return withVectors.length;
  }
}
