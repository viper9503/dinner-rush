import { NextResponse } from "next/server";
import { composeCartView } from "@/lib/dr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const view = await composeCartView(id);
  if (!view.order) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(view);
}
