import { proxyActivities } from "@temporalio/workflow";

const { processInboxRequest } = proxyActivities<{ processInboxRequest: (input: { requestId: string }) => Promise<void> }>({
  startToCloseTimeout: "2 minutes"
});

export async function InboxWorkflow(input: { requestId: string }) {
  await processInboxRequest({ requestId: input.requestId });
}

