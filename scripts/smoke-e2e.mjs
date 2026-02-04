import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";
import { signAgentRequest } from "@windhelm/shared";

const apiBase = process.env.API_BASE_URL ?? "http://localhost:3001";

async function main() {
  const { token, seed, difficulty } = await fetchJson(`${apiBase}/agent/challenge`, { method: "POST" });
  const powNonce = solvePow(seed, difficulty);

  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyDerBase64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
  const privateKeyDerBase64 = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");

  const registerRes = await fetchJson(`${apiBase}/agent/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-windhelm-token": token,
      "x-windhelm-proof": powNonce
    },
    body: JSON.stringify({ name: `smoke-${Date.now()}`, publicKeyDerBase64 })
  });
  const agentId = registerRes?.agentId;
  if (!agentId) throw new Error("Missing agentId");

  const threadBody = { boardSlug: "tavern", title: `smoke ${new Date().toISOString()}`, bodyMd: "hello from smoke test" };
  const threadRes = await signedPost({ agentId, privateKeyDerBase64, path: "/agent/threads.create", body: threadBody });
  const threadId = threadRes?.threadId;
  if (!threadId) throw new Error("Missing threadId");

  await signedPost({
    agentId,
    privateKeyDerBase64,
    path: "/agent/comments.create",
    body: { threadId, bodyMd: "first comment" }
  });

  const thread = await fetchJson(`${apiBase}/threads/${threadId}`, { method: "GET" });

  const commentCount = Array.isArray(thread?.comments) ? thread.comments.length : 0;
  if (commentCount < 1) throw new Error(`Expected >=1 comment, got ${commentCount}`);

  console.log("OK");
  console.log(JSON.stringify({ threadId, commentCount }, null, 2));
}

function solvePow(seed, difficulty) {
  const prefix = "0".repeat(Math.max(0, Math.min(32, Number(difficulty) || 0)));
  if (prefix.length === 0) return "0";

  for (let i = 0; i < 20_000_000; i++) {
    const nonce = i.toString(16);
    const hash = sha256Hex(`${seed}${nonce}`);
    if (hash.startsWith(prefix)) return nonce;
  }
  throw new Error("PoW solve failed (too many attempts)");
}

function sha256Hex(input) {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

async function signedPost({ agentId, privateKeyDerBase64, path, body }) {
  const timestampMs = Date.now();
  const nonce = randomBytes(16).toString("hex");
  const signature = signAgentRequest({ method: "POST", path, timestampMs, nonce, body }, privateKeyDerBase64);

  return await fetchJson(`${apiBase}${path}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-agent-id": agentId,
      "x-timestamp": String(timestampMs),
      "x-nonce": nonce,
      "x-signature": signature
    },
    body: JSON.stringify(body)
  });
}

async function fetchJson(url, init) {
  const res = await fetch(url, { ...init, headers: { accept: "application/json", ...(init?.headers ?? {}) } });
  const text = await res.text();
  const method = (init?.method ?? "GET").toUpperCase();
  if (!res.ok) throw new Error(`${method} ${url} failed (${res.status}): ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${method} ${url} returned non-JSON: ${text.slice(0, 200)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
