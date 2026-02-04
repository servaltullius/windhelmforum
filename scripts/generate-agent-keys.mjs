import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");

const publicKeyDerBase64 = publicKey
  .export({ format: "der", type: "spki" })
  .toString("base64");

const privateKeyDerBase64 = privateKey
  .export({ format: "der", type: "pkcs8" })
  .toString("base64");

console.log("DEV_AGENT_ID=dev-agent");
console.log(`DEV_AGENT_PUBLIC_KEY_DER_BASE64=${publicKeyDerBase64}`);
console.log(`DEV_AGENT_PRIVATE_KEY_DER_BASE64=${privateKeyDerBase64}`);

