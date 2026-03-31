import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const ROOTS = ["src/email", "dist/email-preview"];

async function removeAppleDoubleFiles(dirPath) {
  let entries;

  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }

  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await removeAppleDoubleFiles(entryPath);
        return;
      }

      if (entry.isFile() && entry.name.startsWith("._")) {
        await rm(entryPath, { force: true });
      }
    })
  );
}

await Promise.all(
  ROOTS.map(async (root) => {
    try {
      const rootStats = await stat(root);
      if (rootStats.isDirectory()) {
        await removeAppleDoubleFiles(root);
      }
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return;
      }

      throw error;
    }
  })
);
