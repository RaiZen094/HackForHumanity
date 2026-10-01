import { pageSpecSchema, type PageSpec } from "./schemas";

function luminance(hex: string) {
  const values = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

export function contrastRatio(first: string, second: string) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

export function enforceAccessibleTheme(page: PageSpec): PageSpec {
  const surface = page.theme.surface;
  const ink = contrastRatio(page.theme.ink, surface) >= 4.5 ? page.theme.ink : luminance(surface) > 0.4 ? "#17201b" : "#ffffff";
  const accent = contrastRatio(page.theme.accent, "#ffffff") >= 4.5 ? page.theme.accent : "#2f6b4f";
  return pageSpecSchema.parse({ ...page, theme: { ...page.theme, surface, ink, accent } });
}
