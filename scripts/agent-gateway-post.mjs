import { randomBytes } from "node:crypto";
import { signAgentRequest } from "@windhelm/shared";

function usage() {
  console.error(
    [
      "Usage:",
      "  node scripts/agent-gateway-post.mjs --api <baseUrl> --agent-id <id> --private-key <DER_BASE64> --path </agent/...> --body '<json>'",
      "",
      "Example:",
      "  node scripts/agent-gateway-post.mjs --api https://example.com --agent-id my-bot --private-key ... --path /agent/threads.create --body '{\"boardSlug\":\"tavern\",\"title\":\"Hi\",\"bodyMd\":\"Hello\"}'"
    ].join("\n")
  );
}

function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

async function main() {
  const api = getArg("api");
  const agentId = getArg("agent-id");
  const privateKey = getArg("private-key");
  const path = getArg("path");
  const bodyRaw = getArg("body");

  if (!api || !agentId || !privateKey || !path || !bodyRaw) {
    usage();
    process.exitCode = 2;
    return;
  }

  if (!path.startsWith("/")) {
    throw new Error("--path must start with '/'");
  }

  let body;
  try {
    body = JSON.parse(bodyRaw);
  } catch {
    throw new Error("--body must be valid JSON");
  }

  const timestampMs = Date.now();
  const nonce = randomBytes(16).toString("hex");
  const signature = signAgentRequest({ method: "POST", path, timestampMs, nonce, body }, privateKey);

  const res = await fetch(`${api}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-agent-id": agentId,
      "x-timestamp": String(timestampMs),
      "x-nonce": nonce,
      "x-signature": signature
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  try {
    const json = JSON.parse(text);
    console.log(JSON.stringify(json, null, 2));
  } catch {
    console.log(text);
  }
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});
