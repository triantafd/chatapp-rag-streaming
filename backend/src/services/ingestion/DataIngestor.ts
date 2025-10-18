/** @format */

import crypto from "crypto";
import { EmbeddingService } from "../EmbeddingService";
import { getTables, LanceDocument, LanceChunk } from "../LanceDb";
import { IIngestionSource } from "./IIngestionSource";

export class DataIngestor {
  constructor(private embedder: EmbeddingService) {}

  async ingest(source: IIngestionSource) {
    const { docs: docsTable, chunks: chunksTable } = await getTables();
    const existing = await docsTable
      .query()
      .filter(`"sourceId" = '${source.sourceId}'`)
      .toArray();

    // deletions
    const deleted = await source.getDeletedDocuments(existing);
    for (const doc of deleted) {
      const matches = await chunksTable
        .query()
        .filter(`"documentId" = '${doc.documentId}'`)
        .toArray();
      if (matches.length) {
        await chunksTable.delete(matches.map((m: any) => ({ key: m.key })));
      }
      await docsTable.delete([{ key: doc.key }]);
    }

    // new/modified
    const modified = await source.getNewOrModifiedDocuments(existing);
    for (const doc of modified) {
      await this.reingestOne(doc, source, docsTable, chunksTable);
    }
  }

  private async reingestOne(
    doc: LanceDocument,
    source: IIngestionSource,
    docsTable: any,
    chunksTable: any
  ) {
    const matches = await chunksTable
      .query()
      .filter(`"documentId" = '${doc.documentId}'`)
      .toArray();
    // 1) Delete old chunks for this document
    if (matches.length) {
      await chunksTable.delete(matches.map((m: any) => ({ key: m.key })));
    }
    // 2) Upsert/update the document row
    const docRow = {
      key: doc.key,
      sourceId: doc.sourceId,
      documentId: doc.documentId,
      documentVersion: doc.documentVersion,
    };
    await docsTable.add([docRow]);
    // 3) Build fresh text chunks from the source
    const newChunks = await source.createChunksForDocument(doc);
    // 4) Embed in batches and add chunks with vectors
    const batchSize = 64;
    for (let i = 0; i < newChunks.length; i += batchSize) {
      const slice = newChunks.slice(i, i + batchSize);
      const vecs = await this.embedder.embed(slice.map((s) => s.text));
      const withVectors = slice.map((s, idx) => ({
        key: s.key,
        documentId: s.documentId,
        pageNumber: s.pageNumber,
        text: s.text,
        vector: vecs[idx],
      }));
      await chunksTable.add(withVectors);
    }
  }
}
