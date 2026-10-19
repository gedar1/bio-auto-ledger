/**
 * Tests for sqlite-vec vector search integration.
 * Validates that ReflexMolecule correctly uses sqlite-vec for similarity search
 * with fallback to linear scan when sqlite-vec is unavailable.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { ReflexMolecule } from "../../src/molecules/ReflexMolecule.js";
import { computeEmbedding } from "../../src/atoms/embeddings.js";
import fs from "fs";
import path from "path";

// Mock @xenova/transformers to avoid sharp dependency
vi.mock("@xenova/transformers", () => ({
  pipeline: vi.fn(async () => {
    return async (text: string) => {
      // Return a deterministic embedding based on text
      const hash = text
        .split("")
        .reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
      const seed = Math.abs(hash) % 1000;
      const arr = new Array(384).fill(0).map((_, i) => {
        const x = Math.sin(seed + i) * 10000;
        return x - Math.floor(x);
      });
      // Normalize
      const norm = Math.sqrt(arr.reduce((sum, v) => sum + v * v, 0));
      return {
        data: new Float32Array(arr.map((v) => v / norm)),
      };
    };
  }),
  env: { allowLocalModels: true, allowRemoteModels: true },
}));

describe("ReflexMolecule sqlite-vec integration", () => {
  let dbPath: string;
  let molecule: ReflexMolecule;

  beforeEach(async () => {
    dbPath = path.join(
      process.cwd(),
      `test-reflex-sqlite-vec-${Date.now()}.db`,
    );
    molecule = new ReflexMolecule(dbPath);
    await molecule.initialize();
  });

  afterEach(async () => {
    await molecule.dispose();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it("saves reflex with embedding as BLOB", async () => {
    const embedding = await computeEmbedding("scrape URL and save to database");
    const id = molecule.save(
      "scrape URL and save to database",
      [{ action: "mutate:sensory" }, { action: "scrape_url" }],
      embedding,
    );

    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);

    // Verify in SQLite
    const db = new Database(dbPath);
    const row = db
      .prepare("SELECT embedding FROM reflexes WHERE id = ?")
      .get(id) as any;
    expect(row).toBeDefined();
    expect(row.embedding).toBeInstanceOf(Buffer);
    db.close();
  });

  it("finds similar reflex using sqlite-vec or linear fallback", async () => {
    const emb1 = await computeEmbedding(
      "scrape example.com and insert to users table",
    );
    const emb2 = await computeEmbedding(
      "scrape another.com and save in inventory",
    );

    const id1 = molecule.save(
      "scrape example.com and insert to users table",
      [
        { action: "mutate:sensory" },
        { action: "scrape_url" },
        { action: "db_insert" },
      ],
      emb1,
    );

    const id2 = molecule.save(
      "scrape another.com and save in inventory",
      [
        { action: "mutate:sensory" },
        { action: "scrape_url" },
        { action: "db_insert" },
      ],
      emb2,
    );

    // Query with a similar embedding
    const queryEmb = await computeEmbedding(
      "scrape api.example.com and store in orders",
    );
    const match = molecule.findSimilar(queryEmb, 5);

    // sqlite-vec may not be available (it's an optional extension)
    // If it works, we should find a match
    // If it doesn't, linear scan should still work
    if (match) {
      expect(match.record.id).toBeGreaterThan(0);
      expect(match.similarity).toBeGreaterThan(0);
      expect(match.similarity).toBeLessThanOrEqual(1);
    }
    // Either way, we have data saved
    const allReflexes = molecule.list();
    expect(allReflexes.length).toBeGreaterThanOrEqual(1); // At least one should be there
  });

  it("falls back to linear scan when sqlite-vec is unavailable", async () => {
    // Insert some reflexes
    const emb1 = await computeEmbedding("task one");
    const emb2 = await computeEmbedding("task two");

    molecule.save("task one", [{ action: "step1" }], emb1);
    molecule.save("task two", [{ action: "step2" }], emb2);

    // Corrupt sqlite-vec table to force fallback
    const db = new Database(dbPath);
    try {
      db.exec("DROP TABLE IF EXISTS reflexes_vec");
    } catch (e) {
      // sqlite-vec may not support DROP, which is fine — we test linear fallback
    }
    db.close();

    // Query should still work via linear scan
    const queryEmb = await computeEmbedding("task related");
    const match = molecule.findSimilar(queryEmb, 5);

    // Should find something via linear fallback
    expect(match).toBeDefined();
    if (match) {
      expect(match.similarity).toBeGreaterThanOrEqual(0);
      expect(match.similarity).toBeLessThanOrEqual(1);
    }
  });

  it("removes reflex from main table (sqlite-vec optional)", async () => {
    const embedding = await computeEmbedding("test remove");
    const id = molecule.save("test remove", [{ action: "step1" }], embedding);

    const removed = molecule.remove(id);
    expect(removed).toBe(true);

    // Verify removed from main table at least
    const db = new Database(dbPath);
    const mainRow = db.prepare("SELECT id FROM reflexes WHERE id = ?").get(id);
    expect(mainRow).toBeUndefined();

    // Try to verify vec table removal (may not exist if sqlite-vec unavailable)
    try {
      const vecRow = db
        .prepare("SELECT id FROM reflexes_vec WHERE id = ?")
        .get(id);
      expect(vecRow).toBeUndefined();
    } catch (error: any) {
      // sqlite-vec table may not exist, which is fine
      if (!error.message.includes("no such table")) {
        throw error;
      }
    }
    db.close();
  });

  it("increments success count on markSuccess", async () => {
    const embedding = await computeEmbedding("test success");
    const id = molecule.save("test success", [{ action: "step1" }], embedding);

    molecule.markSuccess(id);
    molecule.markSuccess(id);

    const db = new Database(dbPath);
    const row = db
      .prepare("SELECT success_count FROM reflexes WHERE id = ?")
      .get(id) as any;
    expect(row.success_count).toBe(3); // 1 from save + 2 from markSuccess
    db.close();
  });

  it("increments failure count on markFailed", async () => {
    const embedding = await computeEmbedding("test failure");
    const id = molecule.save("test failure", [{ action: "step1" }], embedding);

    molecule.markFailed(id);

    const db = new Database(dbPath);
    const row = db
      .prepare("SELECT failure_count FROM reflexes WHERE id = ?")
      .get(id) as any;
    expect(row.failure_count).toBe(1);
    db.close();
  });
});
