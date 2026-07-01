import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

// POST /api/revalidate — called by the backend's product-changed subscriber
// whenever an admin edit changes product/category/collection data, so the
// storefront's fetch cache doesn't keep serving stale prices/stock/details.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-revalidate-secret");
  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const tags: string[] = Array.isArray(body?.tags) ? body.tags : [];
  if (!tags.length) {
    return NextResponse.json({ message: "No tags provided" }, { status: 400 });
  }

  tags.forEach((tag) => revalidateTag(tag));
  return NextResponse.json({ revalidated: true, tags });
}
