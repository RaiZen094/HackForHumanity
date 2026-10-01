import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const projectEnvPath = new URL("../.env.local", import.meta.url);
const configPath = process.argv[2] || "D:/backend/web/config.js";
const environmentSourcePath = process.argv[3] || "E:/Users/env.production";
const configText = await readFile(configPath, "utf8");

const assignments = [...configText.matchAll(/([A-Za-z_$][\w$]*)\s*[:=]\s*["']([^"']+)["']/g)];
const candidate = assignments.find((match) => /^sk-[A-Za-z0-9_-]+$/.test(match[2]) && /openai|api.?key/i.test(match[1]))
  ?? assignments.find((match) => /^sk-[A-Za-z0-9_-]+$/.test(match[2]));

if (!candidate) throw new Error("No OpenAI API key was found in the supplied config file.");
const apiKey = candidate[2];
let envText = await readFile(projectEnvPath, "utf8").catch(() => readFile(environmentSourcePath, "utf8"));

function setValue(name, value) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  envText = pattern.test(envText) ? envText.replace(pattern, line) : `${envText.trimEnd()}\n${line}\n`;
}

setValue("OPENAI_API_KEY", apiKey);
setValue("OPENAI_MODEL", "gpt-4o-mini");
setValue("NEXT_PUBLIC_DEMO_MODE", "false");
if (!/^GUEST_SESSION_SECRET=(?!replace_with).{24,}$/m.test(envText)) {
  setValue("GUEST_SESSION_SECRET", randomBytes(32).toString("base64url"));
}

await writeFile(projectEnvPath, `${envText.trim()}\n`, { encoding: "utf8", mode: 0o600 });
console.log(JSON.stringify({
  localEnvironment: "ready",
  openAIKeyConfigured: true,
  openAIKeyLength: apiKey.length,
  databaseMode: "sqlserver",
  sourceConfig: configPath,
  environmentSource: environmentSourcePath,
}, null, 2));
