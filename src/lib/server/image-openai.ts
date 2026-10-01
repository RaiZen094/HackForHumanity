import "server-only";

import OpenAI from "openai";

export async function generateProjectImage(prompt: string, projectContext: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !key.startsWith("sk-") || key.includes("replace_with")) throw new Error("OPENAI_API_KEY is not configured.");
  const client = new OpenAI({ apiKey: key, timeout: 120_000 });
  const response = await client.images.generate({
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare",
    prompt: `Create a polished, credible editorial product visual for this social-impact software: ${projectContext}. Visual request: ${prompt}. No words, letters, logos, UI screenshots, watermarks, flags, or brand marks. Show people and context respectfully; avoid stereotypes. Natural light, documentary-inspired, modern web hero composition with clear negative space.`,
    size: "1536x1024",
    quality: "low",
    output_format: "jpeg",
    output_compression: 78,
    n: 1,
  });
  const encoded = response.data?.[0]?.b64_json;
  if (!encoded) throw new Error("The image model returned no image.");
  return Buffer.from(encoded, "base64");
}
