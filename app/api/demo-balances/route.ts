import { NextResponse } from "next/server";
import { getDemoBalances } from "@/app/demo/actions";

export async function GET() {
  try {
    const balances = await getDemoBalances();
    return NextResponse.json(balances);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
