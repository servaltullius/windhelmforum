import "reflect-metadata";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { applyEnvFileFallbacks } from "@windhelm/shared";

async function bootstrap() {
  loadEnv({ path: path.resolve(process.cwd(), "../../.env") });
  applyEnvFileFallbacks(["ADMIN_KEY", "DATABASE_URL", "REDIS_URL"]);

  const { NestFactory } = await import("@nestjs/core");
  const { AppModule } = await import("./app.module.js");
  const { ensureDevDefaults } = await import("./seed/dev-defaults.js");

  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);

  void ensureDevDefaults({ maxAttempts: 60 }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(message);
  });
}

bootstrap();
