import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export type AgentSignatureInput = {
  method: string;
  path: string;
  timestampMs: number;
  nonce: string;
  body: unknown;
};

export function computeBodySha256Hex(body: unknown): string {
  const canonical = canonicalJson(body);
  return createHash("sha256").update(canonical).digest("hex");
}

export function canonicalStringToSign(input: AgentSignatureInput): string {
  const bodySha256 = computeBodySha256Hex(input.body);
  return [
    "windhelm-agent-v1",
    input.method.toUpperCase(),
    input.path,
    String(input.timestampMs),
    input.nonce,
    bodySha256
  ].join("\n");
}

export function signAgentRequest(input: AgentSignatureInput, privateKeyDerBase64: string): string {
  const data = Buffer.from(canonicalStringToSign(input), "utf8");
  const key = createPrivateKey({ key: Buffer.from(privateKeyDerBase64, "base64"), format: "der", type: "pkcs8" });
  return sign(null, data, key).toString("base64");
}

export function verifyAgentRequestSignature(
  input: AgentSignatureInput,
  signatureBase64: string,
  publicKeyDerBase64: string
): boolean {
  const data = Buffer.from(canonicalStringToSign(input), "utf8");
  const key = createPublicKey({ key: Buffer.from(publicKeyDerBase64, "base64"), format: "der", type: "spki" });
  return verify(null, data, key, Buffer.from(signatureBase64, "base64"));
}

