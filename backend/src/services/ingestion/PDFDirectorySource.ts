/** @format */

import crypto from "crypto";
import { IIngestionSource } from "./IIngestionSource";
import { LanceDocument, LanceChunk } from "../LanceDb";
import fs from "fs";
import path from "path";
import pdf from "pdf-parse";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export class PDFDirectorySource implements IIngestionSource {
  constructor(private directoryPath: string) {}

  get sourceId(): string {
    return `PDFDirectorySource:${this.directoryPath}`;
  }

  static sourceFileId(p: string) {
    return path.basename(p);
  }
  static sourceFileVersion(p: string) {
    return fs.statSync(p).mtime.toISOString();
  }

  async getNewOrModifiedDocuments(
    existingDocuments: ReadonlyArray<LanceDocument>
  ): Promise<LanceDocument[]> {
    const existingById = Object.fromEntries(
      existingDocuments.map((d) => [d.documentId, d] as const)
    );
    const files = fs.existsSync(this.directoryPath)
      ? fs.readdirSync(this.directoryPath)
      : [];
    const pdfs = files.filter((f) => f.toLowerCase().endsWith(".pdf"));
    const results: LanceDocument[] = [];
    for (const f of pdfs) {
      const full = path.join(this.directoryPath, f);
      const id = PDFDirectorySource.sourceFileId(full);
      const ver = PDFDirectorySource.sourceFileVersion(full);
      const current = existingById[id];
      if (!current || current.documentVersion !== ver) {
        results.push({
          key: crypto.randomUUID(),
          sourceId: this.sourceId,
          documentId: id,
          documentVersion: ver,
        });
      }
    }
    return results;
  }

  async getDeletedDocuments(
    existingDocuments: ReadonlyArray<LanceDocument>
  ): Promise<LanceDocument[]> {
    const currentIds = new Set(
      (fs.existsSync(this.directoryPath)
        ? fs.readdirSync(this.directoryPath)
        : []
      )
        .filter((f) => f.toLowerCase().endsWith(".pdf"))
        .map((f) => f)
    );
    return existingDocuments.filter((d) => !currentIds.has(d.documentId));
  }

  async createChunksForDocument(
    document: LanceDocument
  ): Promise<LanceChunk[]> {
    const fullPath = path.join(this.directoryPath, document.documentId);
    const data = await fs.promises.readFile(fullPath);

    const pages: { pageNumber: number; text: string }[] = [];
    await pdf(data, {
      pagerender: (pageData: any) =>
        pageData.getTextContent().then((tc: any) => {
          const text = (tc.items || [])
            .map((it: any) => (it && it.str ? String(it.str) : ""))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          pages.push({ pageNumber: (pageData.pageIndex ?? 0) + 1, text });
          return text;
        }),
    });

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 120,
    });

    const chunks: LanceChunk[] = [];
    for (const p of pages.filter((p) => p.text.length > 0)) {
      const parts = await splitter.splitText(p.text);
      for (const part of parts) {
        chunks.push({
          key: crypto.randomUUID(),
          documentId: document.documentId,
          pageNumber: p.pageNumber,
          text: part,
          vector: [],
        });
      }
    }
    return chunks;
  }
}
