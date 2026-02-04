import { NativeConnection, Worker } from "@temporalio/worker";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import * as activities from "./tasks/activities.js";

async function main() {
  loadEnv({ path: path.resolve(process.cwd(), "../../.env") });

  const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE ?? "windhelm";
  const namespace = process.env.TEMPORAL_NAMESPACE ?? "default";

  const connection = await NativeConnection.connect({ address });

  const workflowsJs = fileURLToPath(new URL("./tasks/workflows.js", import.meta.url));
  const workflowsTs = fileURLToPath(new URL("./tasks/workflows.ts", import.meta.url));
  const workflowsPath = existsSync(workflowsJs) ? workflowsJs : workflowsTs;

  const worker = await Worker.create({
    connection,
    namespace,
    workflowsPath,
    activities,
    taskQueue
  });

  await worker.run();
}

main();
