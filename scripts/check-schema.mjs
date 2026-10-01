import process from "node:process";
import { config } from "dotenv";
import sql from "mssql";

const envPath = process.argv[2] || ".env.local";
config({ path: envPath, quiet: true });
if (process.env.AZURE_SQL_DATABASE !== "ezassist_2_0_0_2_dev") throw new Error("Schema checks are restricted to ezassist_2_0_0_2_dev.");

const pool = await sql.connect({
  server: process.env.AZURE_SQL_SERVER,
  port: Number(process.env.AZURE_SQL_PORT || "1433"),
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: process.env.AZURE_SQL_ENCRYPT !== "false", trustServerCertificate: process.env.AZURE_SQL_TRUST_SERVER_CERTIFICATE === "true", tdsVersion: "7_4", appName: "Worker Studio schema check" },
  connectionTimeout: 10_000,
  requestTimeout: 10_000,
});
try {
  const result = await pool.request().query(`
    SELECT COUNT(*) AS TableCount FROM sys.tables WHERE name IN (
      N'WorkerStudioSchemaMigration', N'WorkerStudioGuestSession', N'WorkerStudioProject', N'WorkerStudioMessage',
      N'WorkerStudioApproval', N'WorkerStudioBuild', N'WorkerStudioRevision', N'WorkerStudioProductEvent', N'WorkerStudioIdempotency',
      N'WorkerStudioWorkerRun', N'WorkerStudioAsset'
    );
    SELECT Version, AppliedAt FROM dbo.WorkerStudioSchemaMigration ORDER BY AppliedAt;
  `);
  const tableCount = result.recordsets[0][0].TableCount;
  console.log(JSON.stringify({ database: process.env.AZURE_SQL_DATABASE, status: tableCount === 11 ? "ready" : "incomplete", tableCount, migrations: result.recordsets[1] }, null, 2));
  if (tableCount !== 11) process.exitCode = 1;
} finally {
  await pool.close();
}
