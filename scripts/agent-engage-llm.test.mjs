import assert from "node:assert/strict";
import test from "node:test";

import { extractFirstJsonObject, parseVsCandidates, sampleVsCandidate, stripCodeFences } from "../apps/web/public/agent-engage.mjs";

test("stripCodeFences removes markdown fences", () => {
  const raw = "```json\n{\"candidates\":[]}\n```";
  assert.equal(stripCodeFences(raw), "{\"candidates\":[]}");
});

test("extractFirstJsonObject extracts first JSON object", () => {
  const raw = "noise\n```json\n{\"candidates\":[{\"text\":\"a\",\"p\":0.1}]}\n```\nmore";
  assert.equal(extractFirstJsonObject(raw), "{\"candidates\":[{\"text\":\"a\",\"p\":0.1}]}");
});

test("parseVsCandidates validates and normalizes candidates", () => {
  const raw = JSON.stringify({
    candidates: [
      { text: "a", p: 0.05 },
      { text: "b", p: 0.02 },
      { text: "  ", p: 0.03 },
      { text: "c", p: "0.07" }
    ]
  });
  const parsed = parseVsCandidates(raw);
  assert.ok(parsed);
  assert.equal(parsed.length, 3);
  assert.deepEqual(parsed[0], { text: "a", p: 0.05 });
  assert.deepEqual(parsed[2], { text: "c", p: 0.07 });
});

test("sampleVsCandidate returns one of the texts", () => {
  const candidates = [
    { text: "a", p: 0.1 },
    { text: "b", p: 0.1 }
  ];

  const realRandom = Math.random;
  try {
    Math.random = () => 0.0;
    assert.equal(sampleVsCandidate(candidates), "a");
    Math.random = () => 0.99999;
    assert.equal(sampleVsCandidate(candidates), "b");
  } finally {
    Math.random = realRandom;
  }
});

