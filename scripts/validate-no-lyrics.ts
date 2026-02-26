import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const REQUIRED_GITIGNORE_ENTRIES = ["dist/", "node_modules/", "lyrics_vault/"] as const;
const CONTENT_DIRS = ["songs", "services", "series"] as const;

function detectLyricLikeContent(markdown: string): string[] {
  const reasons: string[] = [];
  const lines = markdown.split(/\r?\n/);
  const trimmedLines = lines.map((line) => line.trim()).filter((line) => line.length > 0);

  const markerPattern = /^\s*(verse|chorus|bridge|tag|refrain)\b[\s:\d-]*$/i;
  if (trimmedLines.some((line) => markerPattern.test(line))) {
    reasons.push("contains lyric section markers (Verse/Chorus/Bridge/Tag/Refrain)");
  }

  const shortLines = trimmedLines.filter(
    (line) => line.length < 60 && !line.startsWith("#") && !line.startsWith("- ")
  );
  if (shortLines.length > 40) {
    reasons.push("contains more than 40 short line-broken lines (<60 chars)");
  }

  const normalizedCounts = new Map<string, number>();
  for (const line of shortLines) {
    const normalized = line.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
    if (normalized.length < 8) {
      continue;
    }
    normalizedCounts.set(normalized, (normalizedCounts.get(normalized) ?? 0) + 1);
  }
  const repeated = [...normalizedCounts.entries()].filter(([, count]) => count >= 3);
  if (repeated.length > 0) {
    reasons.push("contains repeated short lines that resemble chorus/refrain structure");
  }

  return reasons;
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("_"))
    .map((entry) => path.join(dir, entry.name));
}

function gitLsFiles(target: string): string[] {
  try {
    const output = execFileSync("git", ["ls-files", target], {
      cwd: process.cwd(),
      encoding: "utf8"
    });
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

async function run(): Promise<void> {
  const errors: string[] = [];

  const gitignorePath = path.join(process.cwd(), ".gitignore");
  const gitignoreContent = await fs.readFile(gitignorePath, "utf8");
  for (const required of REQUIRED_GITIGNORE_ENTRIES) {
    if (!gitignoreContent.split(/\r?\n/).some((line) => line.trim() === required)) {
      errors.push(`.gitignore: missing required ignore entry "${required}"`);
    }
  }

  for (const forbiddenPath of ["lyrics_vault", "dist", "node_modules"]) {
    const tracked = gitLsFiles(forbiddenPath);
    if (tracked.length > 0) {
      errors.push(`git: tracked files found under "${forbiddenPath}/": ${tracked.slice(0, 5).join(", ")}`);
    }
  }

  for (const dir of CONTENT_DIRS) {
    const absDir = path.join(process.cwd(), dir);
    const files = await listMarkdownFiles(absDir);
    for (const filePath of files) {
      const content = await fs.readFile(filePath, "utf8");
      const reasons = detectLyricLikeContent(content);
      for (const reason of reasons) {
        errors.push(`${path.relative(process.cwd(), filePath)}: lyric-like content flagged: ${reason}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error("validate-no-lyrics failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("validate-no-lyrics passed.");
}

run().catch((error: unknown) => {
  console.error("validate-no-lyrics failed due to unexpected error.");
  console.error(error);
  process.exit(1);
});
