import { NextResponse, type NextRequest } from "next/server";
import { ANON_COOKIE, parseChannel } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

/**
 * Registra un clic de compra sin redirigir: lo usa "Copiar código" en eventos que
 * venden solo por QR o en puerta (los que venden en ticketera pasan por /r/[id]).
 */
export async function POST(request: NextRequest) {
  let body: { eventId?: unknown; channel?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (typeof body.eventId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.eventId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_click", {
    p_event: body.eventId,
    p_channel: parseChannel(body.channel),
    p_anon: request.cookies.get(ANON_COOKIE)?.value ?? null,
  });
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
