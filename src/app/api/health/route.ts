import { NextResponse } from "next/server";
import { openAIConfigured } from "@/lib/server/openai";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    database: { adapter: "sqlserver", name: process.env.AZURE_SQL_DATABASE || "ezassist_2_0_0_2_dev", configured: Boolean(process.env.AZURE_SQL_SERVER && process.env.AZURE_SQL_USER && process.env.AZURE_SQL_PASSWORD) },
    openai: { configured: openAIConfigured(), model: process.env.OPENAI_MODEL || "gpt-4o-mini" },
    persistence: process.env.NEXT_PUBLIC_DEMO_MODE === "false" ? "sqlserver" : "device-demo",
  });
}
