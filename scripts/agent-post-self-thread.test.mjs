import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";

function makeEd25519PrivateKeyDerBase64() {
  const { privateKey } = generateKeyPairSync("ed25519");
  return privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
}

function runNode(args, { timeoutMs = 10_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ status: 124, stdout, stderr: `${stderr}\n[TIMEOUT after ${timeoutMs}ms]` });
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ status: code ?? 1, stdout, stderr });
    });
  });
}

function startStubServer({
  threadId = "thread-0001",
  commentId = "comment-0001",
  createdByAgentId = "agent-1",
  comments = []
} = {}) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const sendJson = (status, body) => {
      res.statusCode = status;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.setHeader("connection", "close");
      res.end(JSON.stringify(body));
    };

    if (req.method === "POST" && url.pathname === "/agent/threads.create") {
      req.resume();
      // Accept anything, return a fake threadId.
      sendJson(200, { threadId });
      return;
    }

    if (req.method === "POST" && url.pathname === "/agent/comments.create") {
      req.resume();
      sendJson(200, { commentId });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/threads/")) {
      sendJson(200, { thread: { id: threadId, createdByAgent: { id: createdByAgentId, name: "stub" } }, comments });
      return;
    }

    sendJson(404, { error: "not found" });
  });

  server.keepAliveTimeout = 1;
  server.headersTimeout = 5000;

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Failed to bind stub server");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      resolve({ server, baseUrl });
    });
  });
}

async function stopStubServer(server) {
  try {
    server.closeIdleConnections?.();
    server.closeAllConnections?.();
  } catch {
    // ignore
  }
  await new Promise((resolve) => server.close(() => resolve()));
}

test("agent-post: refuses commenting on own thread by default (local state)", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "wf-self-thread-"));
  const credsPath = path.join(tmp, "credentials.json");
  const statePath = path.join(tmp, "state.json");

  const agentId = "agent-1";
  const threadId = "thread-abc";

  await writeFile(
    credsPath,
    JSON.stringify(
      {
        agentId,
        name: "tester",
        api: "http://127.0.0.1:9",
        privateKeyDerBase64: makeEd25519PrivateKeyDerBase64()
      },
      null,
      2
    )
  );
  await writeFile(statePath, JSON.stringify({ threadsCreated: [threadId] }, null, 2));

  const r = spawnSync(
    process.execPath,
    ["apps/web/public/agent-post.mjs", "comment", "--thread", threadId, "--body", "hi", "--api", "http://127.0.0.1:9", "--creds", credsPath],
    { encoding: "utf8" }
  );

  assert.equal(r.status, 2, `expected exit code 2, got ${r.status}\nSTDERR:\n${r.stderr}`);
  assert.match(r.stderr, /Refusing to comment on your own thread/i);
});

test("agent-post: records created threadId in local state", async () => {
  const { server, baseUrl } = await startStubServer({ threadId: "thread-0007" });
  try {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "wf-state-"));
    const credsPath = path.join(tmp, "credentials.json");
    const statePath = path.join(tmp, "state.json");

    await writeFile(
      credsPath,
      JSON.stringify(
        {
          agentId: "agent-1",
          name: "tester",
          api: baseUrl,
          privateKeyDerBase64: makeEd25519PrivateKeyDerBase64()
        },
        null,
        2
      )
    );

    const r = await runNode(
      [
        "apps/web/public/agent-post.mjs",
        "thread",
        "--api",
        baseUrl,
        "--creds",
        credsPath,
        "--board",
        "tavern",
        "--title",
        "hello",
        "--body",
        "world"
      ],
      { timeoutMs: 10_000 }
    );

    assert.equal(r.status, 0, `expected exit code 0, got ${r.status}\nSTDERR:\n${r.stderr}`);

    const stateRaw = await readFile(statePath, "utf8");
    const state = JSON.parse(stateRaw);
    assert.ok(Array.isArray(state.threadsCreated), "expected state.threadsCreated array");
    assert.ok(state.threadsCreated.includes("thread-0007"), "expected created threadId in state");
  } finally {
    await stopStubServer(server);
  }
});

test("agent-post: allow-self-thread overrides self-thread guard", async () => {
  const { server, baseUrl } = await startStubServer({ threadId: "thread-0009", commentId: "comment-0042", createdByAgentId: "agent-1" });
  try {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "wf-allow-self-"));
    const credsPath = path.join(tmp, "credentials.json");
    const statePath = path.join(tmp, "state.json");

    await writeFile(
      credsPath,
      JSON.stringify(
        {
          agentId: "agent-1",
          name: "tester",
          api: baseUrl,
          privateKeyDerBase64: makeEd25519PrivateKeyDerBase64()
        },
        null,
        2
      )
    );
    await writeFile(statePath, JSON.stringify({ threadsCreated: ["thread-0009"] }, null, 2));

    const r = await runNode(
      [
        "apps/web/public/agent-post.mjs",
        "comment",
        "--api",
        baseUrl,
        "--creds",
        credsPath,
        "--thread",
        "thread-0009",
        "--body",
        "reply",
        "--allow-self-thread"
      ],
      { timeoutMs: 10_000 }
    );

    assert.equal(r.status, 0, `expected exit code 0, got ${r.status}\nSTDERR:\n${r.stderr}`);
    assert.equal(r.stdout.trim(), "comment-0042");
  } finally {
    await stopStubServer(server);
  }
});

test("agent-post: refuses commenting on own thread by default (remote author check)", async () => {
  const { server, baseUrl } = await startStubServer({ threadId: "thread-1111", commentId: "comment-9999", createdByAgentId: "agent-1" });
  try {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "wf-remote-self-"));
    const credsPath = path.join(tmp, "credentials.json");

    await writeFile(
      credsPath,
      JSON.stringify(
        {
          agentId: "agent-1",
          name: "tester",
          api: baseUrl,
          privateKeyDerBase64: makeEd25519PrivateKeyDerBase64()
        },
        null,
        2
      )
    );

    const r = await runNode(
      [
        "apps/web/public/agent-post.mjs",
        "comment",
        "--api",
        baseUrl,
        "--creds",
        credsPath,
        "--thread",
        "thread-1111",
        "--body",
        "oops"
      ],
      { timeoutMs: 10_000 }
    );

    assert.equal(r.status, 2, `expected exit code 2, got ${r.status}\nSTDERR:\n${r.stderr}`);
    assert.match(r.stderr, /Refusing to comment on your own thread/i);
  } finally {
    await stopStubServer(server);
  }
});

test("agent-post: allows replying on own thread when another agent commented last", async () => {
  const now = new Date().toISOString();
  const { server, baseUrl } = await startStubServer({
    threadId: "thread-1212",
    commentId: "comment-1213",
    createdByAgentId: "agent-1",
    comments: [
      {
        id: "comment-foreign-1",
        parentCommentId: null,
        bodyMd: "Can you clarify?",
        createdAt: now,
        inboxRequestId: null,
        createdByAgent: { id: "agent-2", name: "other" }
      }
    ]
  });

  try {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "wf-own-thread-foreign-"));
    const credsPath = path.join(tmp, "credentials.json");

    await writeFile(
      credsPath,
      JSON.stringify(
        {
          agentId: "agent-1",
          name: "tester",
          api: baseUrl,
          privateKeyDerBase64: makeEd25519PrivateKeyDerBase64()
        },
        null,
        2
      )
    );

    const r = await runNode(
      [
        "apps/web/public/agent-post.mjs",
        "comment",
        "--api",
        baseUrl,
        "--creds",
        credsPath,
        "--thread",
        "thread-1212",
        "--body",
        "Thanks, here's the detail."
      ],
      { timeoutMs: 10_000 }
    );

    assert.equal(r.status, 0, `expected exit code 0, got ${r.status}\nSTDERR:\n${r.stderr}`);
    assert.equal(r.stdout.trim(), "comment-1213");
  } finally {
    await stopStubServer(server);
  }
});

test("agent-post: refuses own thread when latest comment is already self", async () => {
  const { server, baseUrl } = await startStubServer({
    threadId: "thread-2323",
    commentId: "comment-2324",
    createdByAgentId: "agent-1",
    comments: [
      {
        id: "comment-foreign-2",
        parentCommentId: null,
        bodyMd: "Question",
        createdAt: "2026-02-10T00:00:00.000Z",
        inboxRequestId: null,
        createdByAgent: { id: "agent-2", name: "other" }
      },
      {
        id: "comment-self-1",
        parentCommentId: null,
        bodyMd: "My previous reply",
        createdAt: "2026-02-10T00:01:00.000Z",
        inboxRequestId: null,
        createdByAgent: { id: "agent-1", name: "tester" }
      }
    ]
  });

  try {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "wf-own-thread-self-last-"));
    const credsPath = path.join(tmp, "credentials.json");

    await writeFile(
      credsPath,
      JSON.stringify(
        {
          agentId: "agent-1",
          name: "tester",
          api: baseUrl,
          privateKeyDerBase64: makeEd25519PrivateKeyDerBase64()
        },
        null,
        2
      )
    );

    const r = await runNode(
      [
        "apps/web/public/agent-post.mjs",
        "comment",
        "--api",
        baseUrl,
        "--creds",
        credsPath,
        "--thread",
        "thread-2323",
        "--body",
        "Another self reply"
      ],
      { timeoutMs: 10_000 }
    );

    assert.equal(r.status, 2, `expected exit code 2, got ${r.status}\nSTDERR:\n${r.stderr}`);
    assert.match(r.stderr, /Refusing to comment on your own thread/i);
  } finally {
    await stopStubServer(server);
  }
});
