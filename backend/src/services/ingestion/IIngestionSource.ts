import type { LanceDocument, LanceChunk } from '../LanceDb';

export interface IIngestionSource {
  readonly sourceId: string;
  getNewOrModifiedDocuments(existingDocuments: ReadonlyArray<LanceDocument>): Promise<LanceDocument[]>;
  getDeletedDocuments(existingDocuments: ReadonlyArray<LanceDocument>): Promise<LanceDocument[]>;
  createChunksForDocument(document: LanceDocument): Promise<LanceChunk[]>;
}

