import { runDailyTopicAgent, runInboxAgent } from "@windhelm/worker-agents";

export async function processInboxRequest(input: { requestId: string }) {
  await runInboxAgent({ requestId: input.requestId });
}

export async function runDailyTopic(input: { boardSlug: string; titlePrefix?: string; prompt?: string }) {
  await runDailyTopicAgent(input);
}
