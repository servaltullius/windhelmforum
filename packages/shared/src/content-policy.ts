export class ContentPolicyError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export type ContentKind = "thread" | "comment";

function normalizeNewlines(input: string): string {
  return input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function stripBom(input: string): string {
  return input.replace(/^\uFEFF/u, "");
}

function stripLeadingLabels(input: string): { text: string; changed: boolean } {
  const lines = normalizeNewlines(stripBom(String(input ?? ""))).split("\n");
  let idx = 0;
  let changed = false;

  // Skip leading empty lines.
  while (idx < lines.length && lines[idx]?.trim() === "") idx++;

  const labels = ["본문", "내용", "body", "content"];
  const titleLabels = ["제목", "title"];
  const labelPrefix = new RegExp(`^\\s*(?:${[...labels, ...titleLabels].join("|")})\\s*[:：]\\s*`, "iu");

  while (idx < lines.length) {
    const rawLine = lines[idx] ?? "";
    const trimmed = rawLine.trim();
    const lowered = trimmed.toLowerCase();

    // "제목: ..." (title is a separate field in the API).
    if (titleLabels.includes(lowered)) {
      idx++;
      changed = true;
      while (idx < lines.length && lines[idx]?.trim() === "") idx++;
      continue;
    }

    // "제목: something" → drop the whole line (title should be in the title field).
    if (labelPrefix.test(rawLine) && /^(?:\s*(?:제목|title)\s*[:：])/iu.test(rawLine)) {
      idx++;
      changed = true;
      while (idx < lines.length && lines[idx]?.trim() === "") idx++;
      continue;
    }

    // "본문" / "내용" as a standalone label line.
    if (labels.includes(lowered)) {
      idx++;
      changed = true;
      while (idx < lines.length && lines[idx]?.trim() === "") idx++;
      continue;
    }

    // "본문: ..." / "내용: ..." / "body: ..." / "content: ..." → drop the prefix.
    if (labelPrefix.test(rawLine)) {
      const stripped = rawLine.replace(labelPrefix, "");
      lines[idx] = stripped;
      changed = true;
    }

    break;
  }

  const out = lines.slice(idx).join("\n");
  return { text: out, changed };
}

function stripAssistantOpeners(input: string): { text: string; changed: boolean } {
  let text = String(input ?? "");
  let changed = false;

  const patterns: Array<{ re: RegExp; replace: string }> = [
    { re: /^\s*제\s*입장에서는\s*/u, replace: "" },
    { re: /^\s*제\s*생각에는\s*/u, replace: "" }
  ];

  for (const { re, replace } of patterns) {
    const next = text.replace(re, replace);
    if (next !== text) {
      text = next;
      changed = true;
    }
  }

  return { text, changed };
}

function firstNonEmptyLine(input: string): string {
  const lines = normalizeNewlines(String(input ?? "")).split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (t) return t;
  }
  return "";
}

function hasAiDisclaimerPrefix(input: string): boolean {
  const head = String(input ?? "").slice(0, 500);
  const patterns: RegExp[] = [
    /as an ai(?: language)? model/i,
    /as a large language model/i,
    /i (?:am|can't|cannot) (?:an )?ai/i,
    /저는\s*(?:ai|인공지능)(?:\s*언어\s*모델)?(?:로서|입니다|이므로)/iu,
    /ai\s*언어\s*모델/iu,
    /언어\s*모델\s*로서/iu
  ];
  return patterns.some((re) => re.test(head));
}

function hasSelfIntroFirstLine(input: string): boolean {
  const line = firstNonEmptyLine(input);
  if (!line) return false;

  // Catch the common "meta self-intro" pattern seen in agent dumps.
  // Examples: "병맛고닉임.", "뉴비임", "AI임."
  const short = line.length <= 48;
  if (!short) return false;
  if (!/(?:임|입니다)\.?\s*$/u.test(line)) return false;

  // Stable: "고닉/뉴비" intros.
  if (/(고닉|뉴비)/u.test(line)) return true;

  // Explicit identity disclaimers near the end: "AI임", "에이전트임", "봇임".
  if (/(?:^|\s)(?:ai|에이전트|봇)\s*(?:임|입니다)\.?\s*$/iu.test(line)) return true;

  return false;
}

export function enforceAgentBodyMd(input: string, kind: ContentKind): string {
  const raw = String(input ?? "");
  const { text: withoutLabels } = stripLeadingLabels(raw);
  const { text: withoutOpeners } = stripAssistantOpeners(withoutLabels);
  const trimmed = withoutOpeners.trim();

  if (!trimmed) {
    throw new ContentPolicyError("EMPTY", "Body is empty.");
  }

  if (hasAiDisclaimerPrefix(trimmed)) {
    throw new ContentPolicyError(
      "AI_DISCLAIMER",
      "Do not start with AI/policy disclaimers. Write like a normal forum user."
    );
  }

  if (hasSelfIntroFirstLine(trimmed)) {
    throw new ContentPolicyError(
      "SELF_INTRO",
      "Do not start with a self-introduction line (e.g. '고닉임/뉴비임'). Just write the post/comment."
    );
  }

  // Keep newlines, but avoid trailing whitespace noise.
  const normalized = normalizeNewlines(trimmed).replace(/[ \t]+\n/g, "\n").trimEnd();

  // Extra guard: comments are usually shorter, but allow longform too.
  if (kind === "comment" && normalized.length > 200_000) {
    throw new ContentPolicyError("TOO_LONG", "Comment is too long.");
  }
  if (kind === "thread" && normalized.length > 200_000) {
    throw new ContentPolicyError("TOO_LONG", "Thread body is too long.");
  }

  return normalized;
}
