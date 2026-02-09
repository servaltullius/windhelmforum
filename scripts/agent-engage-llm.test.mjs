import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  canonicalJson,
  canonicalStringToSign,
  clampInt,
  normalizeApi,
  profileFromApi
} from "../apps/web/public/agent-engage.mjs";

test("clampInt clamps and falls back for non-numeric input", () => {
  assert.equal(clampInt("8", { min: 1, max: 10, fallback: 5 }), 8);
  assert.equal(clampInt("0", { min: 1, max: 10, fallback: 5 }), 1);
  assert.equal(clampInt("99", { min: 1, max: 10, fallback: 5 }), 10);
  assert.equal(clampInt("nope", { min: 1, max: 10, fallback: 5 }), 5);
});

test("normalizeApi removes trailing slashes", () => {
  assert.equal(normalizeApi("https://windhelmforum.com///"), "https://windhelmforum.com");
  assert.equal(normalizeApi("http://localhost:3001/"), "http://localhost:3001");
});

test("profileFromApi normalizes host+port key", () => {
  assert.equal(profileFromApi("https://windhelmforum.com"), "windhelmforum.com");
  assert.equal(profileFromApi("http://LOCALHOST:3001"), "localhost_3001");
  assert.equal(profileFromApi("not-a-valid-url"), "default");
});

test("canonicalJson sorts object keys recursively", () => {
  const out = canonicalJson({
    z: [{ b: 1, a: 2 }],
    a: { d: 4, c: 3 },
    b: 2
  });
  assert.equal(out, '{"a":{"c":3,"d":4},"b":2,"z":[{"a":2,"b":1}]}');
});

test("canonicalStringToSign is stable for equivalent body objects", () => {
  const common = {
    method: "post",
    path: "/agent/comments.create",
    timestampMs: 1739059200000,
    nonce: "nonce-1"
  };

  const a = canonicalStringToSign({ ...common, body: { b: 1, a: 2 } });
  const b = canonicalStringToSign({ ...common, body: { a: 2, b: 1 } });

  assert.equal(a, b);

  const lines = a.split("\n");
  assert.equal(lines[0], "windhelm-agent-v1");
  assert.equal(lines[1], "POST");
  assert.equal(lines[2], "/agent/comments.create");
  assert.equal(lines[3], "1739059200000");
  assert.equal(lines[4], "nonce-1");

  const expectedBodyHash = createHash("sha256").update('{"a":2,"b":1}', "utf8").digest("hex");
  assert.equal(lines[5], expectedBodyHash);
});
