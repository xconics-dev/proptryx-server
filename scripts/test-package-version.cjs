#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();

function fail(message) {
  console.error(`version-check failed: ${message}`);
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`could not parse JSON at ${filePath}: ${error.message}`);
  }
}

const packageJsonPath = path.join(root, "package.json");
const changelogPath = path.join(root, "CHANGELOG.md");

if (!fs.existsSync(packageJsonPath)) {
  fail("package.json not found in repository root");
}

if (!fs.existsSync(changelogPath)) {
  fail("CHANGELOG.md not found in repository root");
}

const packageJson = readJson(packageJsonPath);
const version = packageJson.version;

if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
  fail(`package.json version is invalid: ${String(version)}`);
}

const changelog = fs.readFileSync(changelogPath, "utf8");
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
