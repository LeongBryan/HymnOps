import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

interface LocalEmbeddingStub {
  generated_at: string;
  note: string;
  source_dir: string;
  files_indexed: string[];
  embeddings: Array<{ file: string; vector: number[] }>;
}

async function run(): Promise<void> {
  const root = process.cwd();
  const vaultDir = path.join(root, "lyrics_vault");
  const outputDir = path.join(root, ".local");
  const outputFile = path.join(outputDir, "embeddings.local.json");

  let files: string[] = [];
  try {
    const entries = await fs.readdir(vaultDir, { withFileTypes: true });
    files = entries
      .filter((entry) => entry.isFile() && (entry.name.endsWith(".txt") || entry.name.endsWith(".md")))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    files = [];
  }

  const payload: LocalEmbeddingStub = {
    generated_at: new Date().toISOString(),
    note: "Local-only embedding stub. Do not commit this file. Do not run in CI.",
    source_dir: "lyrics_vault/",
    files_indexed: files,
    embeddings: files.map((file) => ({
      file,
      vector: []
    }))
  };

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputFile, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Local embedding stub generated at ${path.relative(root, outputFile)} (${files.length} files indexed).`);
}

run().catch((error: unknown) => {
  console.error("Failed to build local embedding stub.");
  console.error(error);
  process.exit(1);
});
