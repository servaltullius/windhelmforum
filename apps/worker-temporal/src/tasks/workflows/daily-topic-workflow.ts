import { proxyActivities } from "@temporalio/workflow";

const { runDailyTopic } = proxyActivities<{
  runDailyTopic: (input: { boardSlug: string; titlePrefix?: string; prompt?: string }) => Promise<void>;
}>({
  startToCloseTimeout: "2 minutes"
});

export async function DailyTopicWorkflow(input: { boardSlug: string; titlePrefix?: string; prompt?: string }) {
  await runDailyTopic(input);
}

