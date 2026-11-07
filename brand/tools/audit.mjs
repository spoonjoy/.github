#!/usr/bin/env node
// Spoonjoy brand audit: checks every surface in brand/surfaces.json.
//
//   node brand/tools/audit.mjs
//
// For each surface: the README (or org profile) carries its Spoonjoy header, light and dark, and the
// header files exist; each repository has a description, homepage, topics and a custom social preview;
// the org has its name, description and URL. Each brand file matches brand/provenance.json.
// Exit 0 when everything holds, 1 when something is stale, 3 when GitHub can't be reached.
// Needs Node 20+ and a token in GH_TOKEN or GITHUB_TOKEN, or a signed-in `gh`.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BRAND = join(dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(readFileSync(join(BRAND, "surfaces.json"), "utf8"));
const provenance = JSON.parse(readFileSync(join(BRAND, "provenance.json"), "utf8"));
const token =
  process.env.GH_TOKEN ||
  process.env.GITHUB_TOKEN ||
  (() => {
    try {
      return execFileSync("gh", ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      return "";
    }
  })();
const headers = { "user-agent": "spoonjoy-brand-audit", accept: "application/vnd.github+json", ...(token && { authorization: `Bearer ${token}` }) };

class EnvError extends Error {}
async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers }).catch((e) => ({ status: 0, e }));
  if (res.status !== 200) throw new EnvError(`GitHub API ${path} answered ${res.status}`);
  return res.json();
}
async function graphql(query) {
  const res = await fetch("https://api.github.com/graphql", { method: "POST", headers, body: JSON.stringify({ query }) });
  const json = await res.json().catch(() => ({}));
  if (res.status !== 200 || json.errors) throw new EnvError(`GitHub GraphQL answered ${res.status}: ${JSON.stringify(json.errors ?? json).slice(0, 200)}`);
  return json.data;
}
async function readme(repo, path) {
  const data = await api(path ? `/repos/${repo}/contents/${path}` : `/repos/${repo}/readme`);
  return Buffer.from(data.content, "base64").toString("utf8");
}

const problems = [];
const ok = [];
const fail = (id, msg) => problems.push(`${id}: ${msg}`);

// Every brand file is the file provenance.json describes.
for (const entry of provenance) {
  let bytes;
  try {
    bytes = readFileSync(join(BRAND, entry.file));
  } catch {
    fail("provenance", `${entry.file} is listed but missing`);
    continue;
  }
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== entry.sha256) fail("provenance", `${entry.file} sha256 ${sha.slice(0, 12)} differs from provenance.json ${entry.sha256.slice(0, 12)}`);
}
const listed = new Set(provenance.map((e) => e.file));
const need = (file, id) => listed.has(file) || fail(id, `brand/${file} is not in provenance.json`);

try {
  const org = await api(`/orgs/${registry.org.login}`);
  for (const key of ["name", "description", "blog"])
    if (org[key] !== registry.org[key]) fail("org", `${key} is ${JSON.stringify(org[key])}, want ${JSON.stringify(registry.org[key])}`);
  const pins = await graphql(`{ organization(login: "${registry.org.login}") { pinnedItems(first: 6) { nodes { ... on Repository { name } } } } }`);
  const have = pins.organization.pinnedItems.nodes.map((n) => n.name).join(",");
  if (have !== registry.org.pinned.join(",")) fail("org", `pinned repositories are ${have || "none"}, want ${registry.org.pinned.join(",")}`);

  for (const s of registry.surfaces) {
    const text = await readme(s.repo, s.path);
    for (const theme of ["light", "dark"]) {
      const file = `${s.header}-${theme}.webp`;
      need(file, s.id);
      if (!text.includes(registry.canonicalRaw + file)) fail(s.id, `README does not show ${file}`);
    }
    if (!text.includes("prefers-color-scheme: dark")) fail(s.id, "README header has no dark-mode source");
    if (s.kind !== "repo") continue;
    const [owner, name] = s.repo.split("/");
    const data = await graphql(
      `{ repository(owner: "${owner}", name: "${name}") { description homepageUrl usesCustomOpenGraphImage repositoryTopics(first: 20) { nodes { topic { name } } } } }`,
    );
    const r = data.repository;
    if (!r.description) fail(s.id, "no About description");
    if (r.homepageUrl !== s.homepage) fail(s.id, `homepage is ${JSON.stringify(r.homepageUrl)}, want ${s.homepage}`);
    if (!r.repositoryTopics.nodes.length) fail(s.id, "no topics");
    if (!r.usesCustomOpenGraphImage) fail(s.id, `no custom social preview (upload brand/${s.social})`);
    need(s.social, s.id);
    const first = text.replace(/<!-- spoonjoy:brand:start -->[\s\S]*?<!-- spoonjoy:brand:end -->/, "").match(/^#[^\n]*\n+([^\n]+)/m)?.[1]?.trim();
    if (r.description && first !== r.description) fail(s.id, `README's first line after the title should equal the About description:\n    README: ${first}\n    About:  ${r.description}`);
    ok.push(s.id);
  }
} catch (err) {
  if (err instanceof EnvError) {
    console.error(`environment not ready: ${err.message}`);
    process.exit(3);
  }
  throw err;
}

if (problems.length) {
  console.log(`Stale (${problems.length}):\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  console.log("\nFix the surface, or fix brand/surfaces.json if the surface list changed. See AGENTS.md.");
  process.exit(1);
}
console.log(`Every Spoonjoy surface is current: org, profile, ${ok.join(", ")}.`);
