/** @format */

import path from "path";
import { config } from "../config";
import {
  Schema,
  Field,
  Utf8,
  Int32,
  Float32,
  FixedSizeList,
} from "apache-arrow";

const LANCEDB_DIR = config.lanceDir;

let dbPromise: Promise<any> | null = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const { connect } = await import("@lancedb/lancedb");
      return connect(LANCEDB_DIR);
    })();
  }
  return dbPromise;
}

export type LanceChunk = {
  key: string;
  documentId: string;
  pageNumber: number;
  text: string;
  vector: number[]; // keep type for now; you'll write Float32Array at insert time
};

export type LanceDocument = {
  key: string;
  sourceId: string;
  documentId: string;
  documentVersion: string;
};

export async function getTables() {
  const db = await getDb();
  const tables = await db.tableNames();

  const docsName = "documents";
  const chunksName = "chunks";

  let docs: any;
  if (tables.includes(docsName)) {
    docs = await db.openTable(docsName);
  } else {
    const docsSchema = new Schema([
      Field.new({ name: "key", type: new Utf8(), nullable: false }),
      Field.new({ name: "sourceId", type: new Utf8(), nullable: false }),
      Field.new({ name: "documentId", type: new Utf8(), nullable: false }),
      Field.new({ name: "documentVersion", type: new Utf8(), nullable: false }),
    ]);
    // CHANGED: createTable with empty data and schema option
    docs = await db.createTable(docsName, [], { schema: docsSchema });
  }

  let chunks: any;
  if (tables.includes(chunksName)) {
    chunks = await db.openTable(chunksName);
  } else {
    const vectorChild = Field.new({
      name: "item",
      type: new Float32(),
      nullable: false,
    });
    const vectorType = new FixedSizeList(1536, vectorChild);
    const chunksSchema = new Schema([
      Field.new({ name: "key", type: new Utf8(), nullable: false }),
      Field.new({ name: "documentId", type: new Utf8(), nullable: false }),
      Field.new({ name: "pageNumber", type: new Int32(), nullable: false }),
      Field.new({ name: "text", type: new Utf8(), nullable: false }),
      Field.new({ name: "vector", type: vectorType, nullable: false }),
    ]);
    // CHANGED: createTable with empty data and schema option
    chunks = await db.createTable(chunksName, [], { schema: chunksSchema });
  }

  // Ensure index exists (idempotent)
  try {
    // CHANGED: shorthand form is safest across versions
    await chunks.createIndex({
      type: "ivf_pq",
      column: "vector",
      metricType: "cosine",
    });
  } catch {
    /* ignore if exists or unsupported */
  }

  return { docs, chunks };
}
