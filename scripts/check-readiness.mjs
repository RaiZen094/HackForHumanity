import process from "node:process";
import { config } from "dotenv";
import sql from "mssql";

const envPath = process.argv[2] || ".env.local";
config({ path: envPath, quiet: true });

const required = ["AZURE_SQL_SERVER", "AZURE_SQL_DATABASE", "AZURE_SQL_USER", "AZURE_SQL_PASSWORD"];
const missing = required.filter((name) => !process.env[name]);
const placeholderKey = !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes("replace_with");

console.log(JSON.stringify({
  environmentFileLoaded: missing.length < required.length,
  databaseName: process.env.AZURE_SQL_DATABASE || null,
  databaseVariablesComplete: missing.length === 0,
  missingDatabaseVariables: missing,
  openAIKey: placeholderKey ? "placeholder" : "configured",
  openAIModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
}, null, 2));

if (missing.length) process.exit(1);
if (process.env.AZURE_SQL_DATABASE !== "ezassist_2_0_0_2_dev") {
  console.error("Refusing readiness check because the target database name is unexpected.");
  process.exit(1);
}

let pool;
try {
  pool = await sql.connect({
    server: process.env.AZURE_SQL_SERVER,
    port: Number(process.env.AZURE_SQL_PORT || "1433"),
    database: process.env.AZURE_SQL_DATABASE,
    user: process.env.AZURE_SQL_USER,
    password: process.env.AZURE_SQL_PASSWORD,
    options: { encrypt: process.env.AZURE_SQL_ENCRYPT !== "false", trustServerCertificate: process.env.AZURE_SQL_TRUST_SERVER_CERTIFICATE === "true" },
    pool: { min: 0, max: 1, idleTimeoutMillis: 5000 },
    connectionTimeout: 10000,
    requestTimeout: 10000,
  });
  const result = await pool.request().query("SELECT DB_NAME() AS databaseName, CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(128)) AS productVersion");
  console.log(JSON.stringify({ connection: "ok", databaseName: result.recordset[0].databaseName, productVersion: result.recordset[0].productVersion }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ connection: "failed", message: error instanceof Error ? error.message : "Unknown connection error" }, null, 2));
  process.exitCode = 2;
} finally {
  await pool?.close();
}
