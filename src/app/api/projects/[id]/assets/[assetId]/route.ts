import { NextRequest, NextResponse } from "next/server";
import { attachGuestCookie, guestSession } from "@/lib/server/session";
import { getOwnedProjectAsset } from "@/lib/server/repository";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  const { id, assetId } = await params;
  const session = guestSession(request);
  const asset = await getOwnedProjectAsset(session.tokenHash, id, assetId);
  if (!asset) return attachGuestCookie(NextResponse.json({ error: "Image not found." }, { status: 404 }), session);
  return attachGuestCookie(new NextResponse(new Uint8Array(asset.data), { headers: { "Content-Type": asset.mimeType, "Cache-Control": "private, max-age=31536000, immutable" } }), session);
}
