import { readFile, readdir } from "node:fs/promises";
import process from "node:process";
import { config } from "dotenv";
import sql from "mssql";

const envPath = process.argv[2] || ".env.local";
config({ path: envPath, quiet: true });

if (process.env.AZURE_SQL_DATABASE !== "ezassist_2_0_0_2_dev") {
  throw new Error("Schema deployment is restricted to ezassist_2_0_0_2_dev.");
}

const required = ["AZURE_SQL_SERVER", "AZURE_SQL_USER", "AZURE_SQL_PASSWORD"];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is not configured.`);

const pool = await sql.connect({
  server: process.env.AZURE_SQL_SERVER,
  port: Number(process.env.AZURE_SQL_PORT || "1433"),
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: process.env.AZURE_SQL_ENCRYPT !== "false", trustServerCertificate: process.env.AZURE_SQL_TRUST_SERVER_CERTIFICATE === "true", tdsVersion: "7_4", appName: "Worker Studio schema deployment", abortTransactionOnError: true },
  connectionTimeout: 10_000,
  requestTimeout: 30_000,
});

try {
  const databaseDirectory = new URL("../database/", import.meta.url);
  const files = (await readdir(databaseDirectory)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const transaction = new sql.Transaction(pool);
    const ddl = await readFile(new URL(file, databaseDirectory), "utf8");
    try {
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      await transaction.request().batch(ddl);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback().catch(() => undefined);
      throw error;
    }
  }
  const result = await pool.request().query("SELECT Version, AppliedAt FROM dbo.WorkerStudioSchemaMigration ORDER BY AppliedAt;");
  console.log(JSON.stringify({ database: process.env.AZURE_SQL_DATABASE, deployment: "ok", migrations: result.recordset }, null, 2));
} finally {
  await pool.close();
}
