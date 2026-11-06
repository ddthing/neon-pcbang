import { readFile, writeFile } from "node:fs/promises";

const { NEON_WORKER_NAME, NEON_D1_NAME, NEON_D1_ID } = process.env;
const placeholder = "00000000-0000-4000-8000-000000000000";
if (!/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/.test(NEON_WORKER_NAME ?? "") ||
    !NEON_D1_NAME?.trim() ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(NEON_D1_ID ?? "") ||
    NEON_D1_ID === placeholder) {
  throw new Error("Set NEON_WORKER_NAME, NEON_D1_NAME, and NEON_D1_ID in GitHub Actions variables.");
}

const file = new URL("../dist/server/wrangler.json", import.meta.url);
const config = JSON.parse(await readFile(file, "utf8"));
const db = config.d1_databases?.find(({ binding }) => binding === "DB");
if (!db) throw new Error("Build output is missing its DB binding.");
Object.assign(db, { database_id: NEON_D1_ID, database_name: NEON_D1_NAME, migrations_dir: "../../drizzle" });
Object.assign(config, { name: NEON_WORKER_NAME, topLevelName: NEON_WORKER_NAME, workers_dev: true });
await writeFile(file, JSON.stringify(config, null, 2) + "\n");
