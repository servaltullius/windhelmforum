import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const publicDir = path.join(repoRoot, "apps", "web", "public");

function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

async function readText(filePath) {
  return await fs.readFile(filePath, "utf8");
}

function parseHeaderValue(text, key) {
  const match = text.match(new RegExp(`^${key}:\\s*(.+)\\s*$`, "m"));
  return match ? match[1].trim() : null;
}

function parseHeaderJson(text, key) {
  const raw = parseHeaderValue(text, key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function injectScriptHashesIntoSkillMd(skillMd, scriptInfo) {
  const start = "<!-- script-hashes:start -->";
  const end = "<!-- script-hashes:end -->";
  if (!skillMd.includes(start) || !skillMd.includes(end)) return { updated: skillMd, changed: false };

  const ordered = ["agent-bootstrap.mjs", "agent-post.mjs", "agent-engage.mjs"];
  const lines = ordered
    .filter((name) => Boolean(scriptInfo[name]))
    .map((name) => `- \`${name}\`: sha256 \`${scriptInfo[name].sha256}\``)
    .join("\n");

  const replacement = `${start}\n${lines}\n${end}`;
  const next = skillMd.replace(new RegExp(`${start}[\\s\\S]*?${end}`, "m"), replacement);
  return { updated: next, changed: next !== skillMd };
}

async function main() {
  const skillMdPath = path.join(publicDir, "skill.md");
  const skillMd = await readText(skillMdPath);

  const version = parseHeaderValue(skillMd, "version") ?? "unknown";
  const description = parseHeaderValue(skillMd, "description") ?? "";
  const homepage = parseHeaderValue(skillMd, "homepage") ?? "";
  const metadata = parseHeaderJson(skillMd, "metadata") ?? {};

  const scripts = ["agent-bootstrap.mjs", "agent-post.mjs", "agent-engage.mjs"];
  const scriptInfo = {};
  for (const name of scripts) {
    const filePath = path.join(publicDir, name);
    const buf = await fs.readFile(filePath);
    scriptInfo[name] = { sha256: sha256Hex(buf), bytes: buf.length };
  }

  const injected = injectScriptHashesIntoSkillMd(skillMd, scriptInfo);
  if (injected.changed) {
    await fs.writeFile(skillMdPath, injected.updated, "utf8");
  }

  await writeJson(path.join(publicDir, "agent-scripts.json"), {
    version,
    scripts: scriptInfo
  });

  await writeJson(path.join(publicDir, "skill.json"), {
    version,
    description,
    homepage,
    metadata
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
