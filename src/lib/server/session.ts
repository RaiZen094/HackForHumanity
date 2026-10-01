import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "worker_studio_guest";
const MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  const value = process.env.GUEST_SESSION_SECRET;
  if (value && !value.includes("replace_with") && value.length >= 24) return value;
  if (process.env.NODE_ENV !== "production") return "worker-studio-local-development-secret";
  throw new Error("GUEST_SESSION_SECRET is not configured.");
}

function sign(id: string) {
  return createHmac("sha256", secret()).update(id).digest("base64url");
}

function valid(token: string) {
  const [id, signature] = token.split(".");
  if (!id || !signature) return false;
  const expected = Buffer.from(sign(id));
  const actual = Buffer.from(signature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function guestSession(request: NextRequest) {
  const supplied = request.cookies.get(COOKIE_NAME)?.value;
  const normalized = supplied && valid(supplied) ? supplied : (() => { const id = randomBytes(24).toString("base64url"); return `${id}.${sign(id)}`; })();
  return {
    token: normalized,
    tokenHash: createHash("sha256").update(normalized).digest("hex"),
    isNew: normalized !== supplied,
  };
}

export function attachGuestCookie(response: NextResponse, session: ReturnType<typeof guestSession>) {
  if (session.isNew) response.cookies.set(COOKIE_NAME, session.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE });
  return response;
}
