import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const ROOT = ".";
const SKIP_DIRS = new Set([".git", "node_modules", ".turbo"]);

async function removeAppleDoubleFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) {
          return;
        }

        await removeAppleDoubleFiles(entryPath);
        return;
      }

      if (entry.isFile() && (entry.name.startsWith("._") || entry.name === ".DS_Store")) {
        await rm(entryPath, { force: true });
      }
    })
  );
}

await removeAppleDoubleFiles(ROOT);
