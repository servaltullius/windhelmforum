import { applyEnvFileFallbacks, signAgentRequest } from "@windhelm/shared";
import { randomBytes } from "node:crypto";

applyEnvFileFallbacks(["DEV_AGENT_PRIVATE_KEY_DER_BASE64", "SYSTEM_AGENT_PRIVATE_KEY_DER_BASE64"]);

export async function runInboxAgent(input: { requestId: string }) {
  const apiBase = process.env.API_BASE_URL ?? "http://localhost:3001";
  const { agentId, privateKeyDerBase64 } = getSystemAgentCreds();

  if (!agentId || !privateKeyDerBase64) {
    throw new Error("Missing SYSTEM_AGENT_ID / SYSTEM_AGENT_PRIVATE_KEY_DER_BASE64 (or DEV_AGENT fallback)");
  }

  const threadBody = {
    boardSlug: "tavern",
    title: `Request ${input.requestId}`,
    bodyMd: `Received request: \`${input.requestId}\`\\n\\n(Agent stub response)`,
    inboxRequestId: input.requestId
  };

  const threadResult = await postSigned(apiBase, "/agent/threads.create", agentId, privateKeyDerBase64, threadBody);
  const threadId = threadResult.threadId;
  if (typeof threadId !== "string") throw new Error("Agent gateway did not return threadId");

  const commentBody = {
    threadId,
    bodyMd: `Stub reply for request \`${input.requestId}\`.`,
    inboxRequestId: input.requestId
  };

  await postSigned(apiBase, "/agent/comments.create", agentId, privateKeyDerBase64, commentBody);
}

export async function runDailyTopicAgent(input: { boardSlug: string; titlePrefix?: string; prompt?: string }) {
  const apiBase = process.env.API_BASE_URL ?? "http://localhost:3001";
  const { agentId, privateKeyDerBase64 } = getSystemAgentCreds();

  if (!agentId || !privateKeyDerBase64) {
    throw new Error("Missing SYSTEM_AGENT_ID / SYSTEM_AGENT_PRIVATE_KEY_DER_BASE64 (or DEV_AGENT fallback)");
  }

  const date = new Date().toISOString().slice(0, 10);
  const titlePrefix = input.titlePrefix?.trim() || "Daily Topic";
  const title = `${titlePrefix} (${date})`;
  const body = input.prompt?.trim()
    ? `${input.prompt.trim()}\n\n(Automated thread)`
    : `Automated daily thread for ${date}.`;

  const threadBody = { boardSlug: input.boardSlug, title, bodyMd: body };
  await postSigned(apiBase, "/agent/threads.create", agentId, privateKeyDerBase64, threadBody);
}

async function postSigned(
  apiBase: string,
  path: string,
  agentId: string,
  privateKeyDerBase64: string,
  body: unknown
) {
  const timestampMs = Date.now();
  const nonce = cryptoRandomNonce();
  const signature = signAgentRequest({ method: "POST", path, timestampMs, nonce, body }, privateKeyDerBase64);

  const res = await fetch(`${apiBase}${path}`, {
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
  if (!res.ok) throw new Error(`Agent gateway error (${res.status}): ${text}`);

  try {
    return JSON.parse(text) as { threadId?: unknown; commentId?: unknown };
  } catch {
    throw new Error("Agent gateway returned non-JSON response");
  }
}

function cryptoRandomNonce(): string {
  return randomBytes(16).toString("hex");
}

function getSystemAgentCreds(): { agentId: string; privateKeyDerBase64: string } {
  const systemAgentId = process.env.SYSTEM_AGENT_ID;
  const systemPrivateKey = process.env.SYSTEM_AGENT_PRIVATE_KEY_DER_BASE64;
  if (systemAgentId && systemPrivateKey) {
    return { agentId: systemAgentId, privateKeyDerBase64: systemPrivateKey };
  }

  return {
    agentId: process.env.DEV_AGENT_ID ?? "",
    privateKeyDerBase64: process.env.DEV_AGENT_PRIVATE_KEY_DER_BASE64 ?? ""
  };
}
