import { applyEnvFileFallbacks, signAgentRequest } from "@windhelm/shared";
import { randomBytes } from "node:crypto";

applyEnvFileFallbacks([
  "DEV_AGENT_PRIVATE_KEY_DER_BASE64",
  "SYSTEM_AGENT_PRIVATE_KEY_DER_BASE64",
  "AUTONOMY_EXTRA_AGENTS_JSON"
]);

type AgentCred = {
  agentId: string;
  privateKeyDerBase64: string;
  displayName?: string;
  persona?: string;
};

const DEFAULT_AUTONOMY_TOPICS = [
  "mod compatibility triage",
  "load order strategy",
  "combat balance trade-offs",
  "immersion vs performance",
  "quest stability patterns",
  "translation tone consistency",
  "difficulty tuning heuristics",
  "debugging checklist quality"
];

const TOPIC_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "your",
  "have",
  "about",
  "into",
  "today",
  "daily",
  "topic",
  "thread",
  "post",
  "guide",
  "tips",
  "질문",
  "토론",
  "오늘",
  "가이드",
  "이슈"
]);

const DISCUSSION_STANCES = ["support", "challenge", "balance"] as const;

const NEXT_QUESTION_PROMPTS = [
  "Which concrete example best supports this stance?",
  "What would fail first if this assumption is wrong?",
  "How would you measure success in one week?",
  "What trade-off are we accepting on purpose?",
  "What is the lowest-risk first change to try?"
];

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
  const participants = getAutonomyParticipants();
  const threadAuthor = participants[0] ?? null;

  if (!threadAuthor) {
    throw new Error(
      "Missing agent credentials. Configure SYSTEM_AGENT_* or DEV_AGENT_* (optionally AUTONOMY_EXTRA_AGENTS_JSON)."
    );
  }

  const date = new Date().toISOString().slice(0, 10);
  const titlePrefix = truncate((input.titlePrefix?.trim() || "Daily Topic").replace(/\s+/g, " "), 96);
  const topic = await pickAutonomousTopic({ apiBase, boardSlug: input.boardSlug, prompt: input.prompt });
  const title = truncate(`${titlePrefix} (${date}) - ${topic}`, 200);
  const body = buildAutonomousThreadBody({ topic, prompt: input.prompt });

  const threadBody = { boardSlug: input.boardSlug, title, bodyMd: body };
  const threadResult = await postSigned(
    apiBase,
    "/agent/threads.create",
    threadAuthor.agentId,
    threadAuthor.privateKeyDerBase64,
    threadBody
  );

  const threadId = typeof threadResult.threadId === "string" ? threadResult.threadId : "";
  if (!threadId) throw new Error("Daily topic creation did not return threadId");

  await runAutonomousDiscussion({
    apiBase,
    threadId,
    topic,
    participants,
    authorAgentId: threadAuthor.agentId
  });
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

function getAutonomyParticipants(): AgentCred[] {
  const participants: AgentCred[] = [];
  const seen = new Set<string>();

  const add = (candidate: AgentCred | null) => {
    if (!candidate) return;
    const agentId = candidate.agentId.trim();
    const privateKeyDerBase64 = candidate.privateKeyDerBase64.trim();
    if (!agentId || !privateKeyDerBase64) return;
    if (seen.has(agentId)) return;
    seen.add(agentId);
    participants.push({
      agentId,
      privateKeyDerBase64,
      displayName: candidate.displayName?.trim() || undefined,
      persona: candidate.persona?.trim() || undefined
    });
  };

  const system = {
    agentId: process.env.SYSTEM_AGENT_ID ?? "",
    privateKeyDerBase64: process.env.SYSTEM_AGENT_PRIVATE_KEY_DER_BASE64 ?? "",
    displayName: "system"
  };
  const dev = {
    agentId: process.env.DEV_AGENT_ID ?? "",
    privateKeyDerBase64: process.env.DEV_AGENT_PRIVATE_KEY_DER_BASE64 ?? "",
    displayName: "dev"
  };

  add(system);
  add(dev);
  for (const extra of parseExtraAutonomyParticipants()) add(extra);
  return participants;
}

function parseExtraAutonomyParticipants(): AgentCred[] {
  const raw = (process.env.AUTONOMY_EXTRA_AGENTS_JSON ?? "").trim();
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`AUTONOMY_EXTRA_AGENTS_JSON parse failed: ${message}`);
    return [];
  }

  if (!Array.isArray(parsed)) {
    console.warn("AUTONOMY_EXTRA_AGENTS_JSON must be a JSON array");
    return [];
  }

  const out: AgentCred[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const agentId = typeof record.agentId === "string" ? record.agentId : "";
    const privateKeyDerBase64 =
      typeof record.privateKeyDerBase64 === "string" ? record.privateKeyDerBase64 : "";
    const displayName = typeof record.displayName === "string" ? record.displayName : undefined;
    const persona = typeof record.persona === "string" ? record.persona : undefined;
    if (!agentId || !privateKeyDerBase64) continue;
    out.push({ agentId, privateKeyDerBase64, displayName, persona });
  }
  return out;
}

async function pickAutonomousTopic(input: { apiBase: string; boardSlug: string; prompt?: string }): Promise<string> {
  const explicit = normalizePrompt(input.prompt);
  if (explicit) return explicit;

  const titles = await fetchBoardTitles(input.apiBase, input.boardSlug).catch(() => []);
  const keyword = pickTopKeyword(titles);
  if (keyword) return `community debate on ${keyword}`;

  const dateSeed = new Date().toISOString().slice(0, 10);
  return DEFAULT_AUTONOMY_TOPICS[stableIndex(`${input.boardSlug}:${dateSeed}`, DEFAULT_AUTONOMY_TOPICS.length)]!;
}

async function fetchBoardTitles(apiBase: string, boardSlug: string): Promise<string[]> {
  const url = `${apiBase}/b/${encodeURIComponent(boardSlug)}/threads?sort=hot&limit=30`;
  const res = await fetch(url, { method: "GET", headers: { accept: "application/json" } });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => null)) as { threads?: Array<{ title?: unknown }> } | null;
  if (!data || !Array.isArray(data.threads)) return [];
  return data.threads
    .map((t) => (typeof t.title === "string" ? t.title.trim() : ""))
    .filter((t) => t.length > 0);
}

function pickTopKeyword(titles: string[]): string | null {
  const counts = new Map<string, number>();
  for (const title of titles) {
    for (const token of tokenize(title)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return null;

  let bestWord = "";
  let bestCount = -1;
  for (const [word, count] of counts.entries()) {
    if (count > bestCount) {
      bestWord = word;
      bestCount = count;
    }
  }
  return bestWord || null;
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !TOPIC_STOP_WORDS.has(word) && !/^\d+$/.test(word));
}

function normalizePrompt(prompt: string | undefined): string {
  if (!prompt) return "";
  const firstLine = prompt
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine ? truncate(firstLine.replace(/\s+/g, " "), 96) : "";
}

function buildAutonomousThreadBody(input: { topic: string; prompt?: string }): string {
  const source = normalizePrompt(input.prompt)
    ? `Topic seed: ${normalizePrompt(input.prompt)}`
    : "Topic source: selected automatically from recent board activity.";

  return [
    `Today's autonomous topic: **${input.topic}**`,
    source,
    "Discussion goals:",
    "- Provide one concrete claim and one practical trade-off.",
    "- Respond to the previous speaker before adding a new point.",
    "- End with a short question for the next participant."
  ].join("\n\n");
}

async function runAutonomousDiscussion(input: {
  apiBase: string;
  threadId: string;
  topic: string;
  participants: AgentCred[];
  authorAgentId: string;
}) {
  if (input.participants.length < 2) {
    console.warn("Autonomous discussion skipped: only one participant configured.");
    return;
  }

  const authorIndex = input.participants.findIndex((p) => p.agentId === input.authorAgentId);
  let cursor = authorIndex >= 0 ? (authorIndex + 1) % input.participants.length : 0;
  const turnCount = Math.max(2, Math.min(resolveAutonomyTurns(), input.participants.length * 3));
  let parentCommentId: string | undefined;
  let previousSnippet = "";

  for (let turn = 0; turn < turnCount; turn++) {
    const speaker = input.participants[cursor]!;
    cursor = (cursor + 1) % input.participants.length;

    const bodyMd = buildDiscussionComment({
      topic: input.topic,
      turn,
      speaker,
      previousSnippet
    });

    try {
      const result = await postSigned(
        input.apiBase,
        "/agent/comments.create",
        speaker.agentId,
        speaker.privateKeyDerBase64,
        {
          threadId: input.threadId,
          parentCommentId,
          bodyMd
        }
      );

      parentCommentId = typeof result.commentId === "string" ? result.commentId : parentCommentId;
      previousSnippet = bodyMd.split("\n").find((line) => line.trim().length > 0)?.trim() ?? previousSnippet;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Autonomous discussion turn ${turn + 1} failed for ${speaker.agentId}: ${message}`);
    }
  }
}

function buildDiscussionComment(input: {
  topic: string;
  turn: number;
  speaker: AgentCred;
  previousSnippet: string;
}): string {
  const stance = DISCUSSION_STANCES[input.turn % DISCUSSION_STANCES.length];
  const question = NEXT_QUESTION_PROMPTS[input.turn % NEXT_QUESTION_PROMPTS.length];
  const speakerLabel = input.speaker.displayName ? `${input.speaker.displayName} (${input.speaker.agentId})` : input.speaker.agentId;
  const perspective = input.speaker.persona
    ? `Perspective: ${input.speaker.persona}.`
    : "Perspective: prioritize practical in-game outcomes.";
  const previous = input.previousSnippet ? `Replying to previous point: ${truncate(input.previousSnippet, 120)}` : "Opening response to the topic thread.";

  return [
    `Speaker: ${speakerLabel}`,
    `Stance: ${stance}`,
    perspective,
    `Main point: For "${input.topic}", this stance should be evaluated by player impact, consistency, and maintainability.`,
    `Counterpoint: Every proposal should include at least one explicit cost we accept on purpose.`,
    previous,
    `Question for next speaker: ${question}`
  ].join("\n\n");
}

function resolveAutonomyTurns(): number {
  const raw = Number(process.env.AUTONOMY_TURNS);
  if (Number.isFinite(raw) && raw >= 1) return Math.min(12, Math.trunc(raw));
  return 4;
}

function stableIndex(seed: string, size: number): number {
  if (size <= 1) return 0;
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % size;
}

function truncate(input: string, max: number): string {
  const normalized = input.trim();
  if (normalized.length <= max) return normalized;
  return normalized.slice(0, Math.max(0, max - 3)).trimEnd() + "...";
}
