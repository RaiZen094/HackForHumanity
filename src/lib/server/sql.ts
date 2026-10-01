import "server-only";

import sql from "mssql";

function required(name: string) {
  const value = process.env[name];
  if (!value || value.includes("replace_with")) throw new Error(`${name} is not configured.`);
  return value;
}

const globalForSql = globalThis as unknown as { workerStudioSqlPool?: Promise<sql.ConnectionPool> };

export function sqlConfig(): sql.config {
  return {
    server: required("AZURE_SQL_SERVER"),
    port: Number(process.env.AZURE_SQL_PORT || "1433"),
    database: process.env.AZURE_SQL_DATABASE || "ezassist_2_0_0_2_dev",
    user: required("AZURE_SQL_USER"),
    password: required("AZURE_SQL_PASSWORD"),
    pool: { max: 5, min: 0, idleTimeoutMillis: 30_000 },
    options: {
      encrypt: process.env.AZURE_SQL_ENCRYPT !== "false",
      trustServerCertificate: process.env.AZURE_SQL_TRUST_SERVER_CERTIFICATE === "true",
      tdsVersion: "7_4",
      appName: "Worker Studio",
      abortTransactionOnError: true,
    },
    connectionTimeout: 10_000,
    requestTimeout: 15_000,
  };
}

export async function getSqlPool() {
  if (globalForSql.workerStudioSqlPool) {
    try {
      const existing = await globalForSql.workerStudioSqlPool;
      if (existing.connected) return existing;
      await existing.close().catch(() => undefined);
    } catch {
      // Recreate a pool after a failed or interrupted connection attempt.
    }
    globalForSql.workerStudioSqlPool = undefined;
  }

  const pool = new sql.ConnectionPool(sqlConfig());
  const pending = pool.connect();
  globalForSql.workerStudioSqlPool = pending;
  pool.on("error", () => {
    if (globalForSql.workerStudioSqlPool === pending) globalForSql.workerStudioSqlPool = undefined;
  });
  try {
    return await pending;
  } catch (error) {
    if (globalForSql.workerStudioSqlPool === pending) globalForSql.workerStudioSqlPool = undefined;
    throw error;
  }
}

