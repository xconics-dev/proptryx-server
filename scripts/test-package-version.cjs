#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { readFile } = require("node:fs/promises");

const root = process.cwd();

function fail(message, error) {
  console.error(`version-check failed: ${message}`);
  if (error) {
    if (error.stack) {
      console.error(error.stack);
    } else {
      console.error(error);
    }
  }
  process.exit(1);
}

async function readJson(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    fail(`could not read/parse JSON at ${filePath}: ${error.message}`, error);
  }
}

const packageJsonPath = path.join(root, "package.json");
const changelogPath = path.join(root, "CHANGELOG.md");

async function main() {
  if (!fs.existsSync(packageJsonPath)) {
    fail("package.json not found in repository root");
  }

  if (!fs.existsSync(changelogPath)) {
    fail("CHANGELOG.md not found in repository root");
  }

  const packageJson = await readJson(packageJsonPath);
  const version = packageJson.version;

  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
    fail(`package.json version is invalid: ${String(version)}`);
  }

  const changelog = await readFile(changelogPath, "utf8");
  const match = changelog.match(/^##\s+(\d+\.\d+\.\d+)\b/m);

  if (!match) {
    fail("no release header like '## x.y.z' found in CHANGELOG.md");
  }

  const latestChangelogVersion = match[1];
  if (latestChangelogVersion !== version) {
    fail(
      `package.json version (${version}) does not match latest changelog version (${latestChangelogVersion})`
    );
  }

  console.log(`version-check passed: ${version}`);
}

main().catch((error) => {
  fail("unexpected error during version check", error);
});
