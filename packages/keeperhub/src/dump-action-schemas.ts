import { config as loadDotEnv } from "dotenv";
import { dirname, join } from "node:path";
import { existsSync, writeFileSync } from "node:fs";
import { HttpKeeperHubClient } from "./client";

function loadEnvFromWorkspace(): void {
  let currentDir = process.cwd();
  while (true) {
    const envPath = join(currentDir, ".env");
    if (existsSync(envPath)) {
      loadDotEnv({ path: envPath });
      return;
    }
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return;
    }
    currentDir = parentDir;
  }
}

loadEnvFromWorkspace();

const apiUrl = process.env.KEEPERHUB_API_URL;
const apiKey = process.env.KEEPERHUB_API_KEY;

if (!apiUrl || !apiKey) {
  console.error("Missing env vars: KEEPERHUB_API_URL and KEEPERHUB_API_KEY");
  process.exit(1);
}

async function main(): Promise<void> {
  const client = new HttpKeeperHubClient({ apiUrl, apiKey });
  const result = await client.listActionSchemas();

  if (!result.ok) {
    console.error("Failed to fetch action schemas:", result.error.message);
    process.exit(1);
  }

  const schemas = result.value;
  const outputPath = join(process.cwd(), "action-schemas.dump.json");

  const payload = {
    generatedAt: new Date().toISOString(),
    apiUrl,
    count: schemas.length,
    schemas,
  };

  writeFileSync(outputPath, JSON.stringify(payload, null, 2));

  console.log(`Dumped ${schemas.length} action schemas to ${outputPath}`);
}

void main();
