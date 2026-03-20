#!/usr/bin/env node

import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

const WORKSPACE_FOLDERS = ["apps", "packages", "services"] as const;
const DEFAULT_TOP = 80;

type DependencyField = (typeof DEPENDENCY_FIELDS)[number];
type PackageSpecifierMap = Record<string, string>;

interface PackageManifest extends Partial<Record<DependencyField, PackageSpecifierMap>> {
  name?: string;
}

interface DependencyUsage {
  usedBy: Set<string>;
  fields: Set<DependencyField>;
  specifiers: Set<string>;
}

interface ParsedPnpmStoreEntry {
  packageName: string;
  version: string;
}

interface DependencyReportRow {
  packageName: string;
  usedByCount: number;
  specifierCount: number;
  versionCount: number;
  sizeBytes: number;
}

function hasArg(name: string): boolean {
  return process.argv.includes(name);
}

function getArgValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1 || index === process.argv.length - 1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function decodePnpmEncodedPackageName(encodedName: string): string {
  if (!encodedName.startsWith("@")) {
    return encodedName;
  }

  const separatorIndex = encodedName.indexOf("+");
  if (separatorIndex === -1) {
    return encodedName;
  }

  return `${encodedName.slice(0, separatorIndex)}/${encodedName.slice(separatorIndex + 1)}`;
}

function splitPackageNameForPath(packageName: string): string[] {
  if (!packageName.startsWith("@")) {
    return [packageName];
  }

  return packageName.split("/");
}

function parsePnpmStoreEntry(entryName: string): ParsedPnpmStoreEntry | null {
  const baseName = entryName.split("(")[0];
  const match = baseName.match(/^(.*)@([^@]+)$/);
  if (!match) {
    return null;
  }

  return {
    packageName: decodePnpmEncodedPackageName(match[1]),
    version: match[2],
  };
}

async function collectPackageManifestPaths(rootDir: string): Promise<string[]> {
  const manifests = [path.join(rootDir, "package.json")];

  for (const folder of WORKSPACE_FOLDERS) {
    const workspaceDir = path.join(rootDir, folder);
    if (!(await pathExists(workspaceDir))) {
      continue;
    }

    const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const manifestPath = path.join(workspaceDir, entry.name, "package.json");
      if (await pathExists(manifestPath)) {
        manifests.push(manifestPath);
      }
    }
  }

  return manifests;
}

async function collectDeclaredDependencyUsage(
  rootDir: string
): Promise<Map<string, DependencyUsage>> {
  const manifests = await collectPackageManifestPaths(rootDir);
  const dependencyUsage = new Map<string, DependencyUsage>();

  for (const manifestPath of manifests) {
    const manifest = await readJsonFile<PackageManifest>(manifestPath);
    const relativePath = toPosixPath(path.relative(rootDir, manifestPath));
    const owner = manifest.name || relativePath.replace(/\/package\.json$/, "");

    for (const field of DEPENDENCY_FIELDS) {
      const dependencies = manifest[field];
      if (!dependencies || typeof dependencies !== "object") {
        continue;
      }

      for (const [packageName, specifier] of Object.entries(dependencies)) {
        const existing = dependencyUsage.get(packageName) ?? {
          usedBy: new Set<string>(),
          fields: new Set<DependencyField>(),
          specifiers: new Set<string>(),
        };

        existing.usedBy.add(owner);
        existing.fields.add(field);
        existing.specifiers.add(`${field}:${specifier}`);
        dependencyUsage.set(packageName, existing);
      }
    }
  }

  return dependencyUsage;
}

async function getDirectorySizeBytes(rootDir: string): Promise<number> {
  let totalBytes = 0;
  const stack: string[] = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    let entries: Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      let stats;
      try {
        stats = await fs.lstat(fullPath);
      } catch {
        continue;
      }

      if (stats.isSymbolicLink()) {
        continue;
      }

      if (stats.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (stats.isFile()) {
        totalBytes += stats.size;
      }
    }
  }

  return totalBytes;
}

async function collectInstalledPackageSizes(
  rootDir: string,
  targetPackageNames: Set<string>
): Promise<Map<string, Map<string, number>>> {
  const pnpmStoreDir = path.join(rootDir, "node_modules", ".pnpm");
  if (!(await pathExists(pnpmStoreDir))) {
    throw new Error("node_modules/.pnpm not found. Run `pnpm install` first.");
  }

  const entries = await fs.readdir(pnpmStoreDir, { withFileTypes: true });
  const seenVersions = new Set<string>();
  const installedSizes = new Map<string, Map<string, number>>();

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const parsed = parsePnpmStoreEntry(entry.name);
    if (!parsed) {
      continue;
    }

    if (!targetPackageNames.has(parsed.packageName)) {
      continue;
    }

    const versionKey = `${parsed.packageName}@${parsed.version}`;
    if (seenVersions.has(versionKey)) {
      continue;
    }

    const packageDir = path.join(
      pnpmStoreDir,
      entry.name,
      "node_modules",
      ...splitPackageNameForPath(parsed.packageName)
    );

    if (!(await pathExists(packageDir))) {
      continue;
    }

    const sizeBytes = await getDirectorySizeBytes(packageDir);
    seenVersions.add(versionKey);

    const versions = installedSizes.get(parsed.packageName) ?? new Map<string, number>();
    versions.set(parsed.version, sizeBytes);
    installedSizes.set(parsed.packageName, versions);
  }

  return installedSizes;
}

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = unitIndex === 0 ? 0 : 2;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 3) {
    return value.slice(0, maxLength);
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function printTable(columns: string[], rows: Array<Array<string | number>>) {
  const widths = columns.map((column, index) => {
    const rowWidth = rows.reduce((max, row) => Math.max(max, String(row[index]).length), 0);
    return Math.max(column.length, rowWidth);
  });

  const header = columns.map((column, index) => column.padEnd(widths[index])).join("  ");
  const separator = widths.map((width) => "-".repeat(width)).join("  ");

  console.log(header);
  console.log(separator);

  for (const row of rows) {
    const rendered = row
      .map((cell, index) => {
        const value = String(cell);
        if (index === columns.length - 1 || columns[index].toLowerCase().includes("size")) {
          return value.padStart(widths[index]);
        }

        return value.padEnd(widths[index]);
      })
      .join("  ");

    console.log(rendered);
  }
}

function parseTopLimit(defaultValue: number): number {
  if (hasArg("--all")) {
    return Number.POSITIVE_INFINITY;
  }

  const topArg = getArgValue("--top");
  if (!topArg) {
    return defaultValue;
  }

  const parsed = Number.parseInt(topArg, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return parsed;
}

async function main() {
  const rootDir = process.cwd();
  const topLimit = parseTopLimit(DEFAULT_TOP);

  const dependencyUsage = await collectDeclaredDependencyUsage(rootDir);
  const targetPackageNames = new Set(dependencyUsage.keys());

  const installedSizes = await collectInstalledPackageSizes(rootDir, targetPackageNames);

  const rows: DependencyReportRow[] = [];
  let totalInstalledBytes = 0;

  for (const [packageName, usage] of dependencyUsage.entries()) {
    const versions = installedSizes.get(packageName) ?? new Map<string, number>();
    const versionCount = versions.size;
    const totalSize = Array.from(versions.values()).reduce((sum, size) => sum + size, 0);
    totalInstalledBytes += totalSize;

    rows.push({
      packageName,
      usedByCount: usage.usedBy.size,
      specifierCount: usage.specifiers.size,
      versionCount,
      sizeBytes: totalSize,
    });
  }

  rows.sort((a, b) => {
    if (b.sizeBytes !== a.sizeBytes) {
      return b.sizeBytes - a.sizeBytes;
    }

    if (b.usedByCount !== a.usedByCount) {
      return b.usedByCount - a.usedByCount;
    }

    return a.packageName.localeCompare(b.packageName);
  });

  const visibleRows = rows.slice(0, topLimit);
  const tableRows: Array<Array<string | number>> = visibleRows.map((row) => [
    truncate(row.packageName, 46),
    row.usedByCount,
    row.specifierCount,
    row.versionCount,
    formatBytes(row.sizeBytes),
  ]);

  console.log("Dependency Size Report");
  console.log(`Workspace packages scanned: ${WORKSPACE_FOLDERS.join(", ")} + root`);
  console.log(`Direct dependencies found: ${rows.length}`);
  console.log(`Approx installed size (direct deps aggregate): ${formatBytes(totalInstalledBytes)}`);
  if (Number.isFinite(topLimit) && rows.length > topLimit) {
    console.log(`Showing top ${topLimit} packages by installed size. Use --all to show all.`);
  }
  console.log("");

  printTable(["Package", "UsedBy", "Specs", "Versions", "ApproxSize"], tableRows);

  const centralizationCandidates: Array<Array<string | number>> = rows
    .filter((row) => row.usedByCount >= 2 || row.versionCount >= 2)
    .slice(0, 30)
    .map((row) => [
      truncate(row.packageName, 46),
      row.usedByCount,
      row.versionCount,
      formatBytes(row.sizeBytes),
    ]);

  if (centralizationCandidates.length > 0) {
    console.log("");
    console.log(
      "Reuse/Centralization Candidates (used by multiple packages or multiple installed versions)"
    );
    printTable(["Package", "UsedBy", "Versions", "ApproxSize"], centralizationCandidates);
  }
}

main().catch((error: unknown) => {
  console.error("Failed to generate dependency size report.");
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
