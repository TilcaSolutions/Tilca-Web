import { NextResponse, type NextRequest } from "next/server";
import { ANON_COOKIE, parseChannel } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { TEST_TICKETING_ENABLED } from "@/lib/test-ticketing";

/**
 * /r/[eventoId]?c=[canal]
 * Registra el clic en "Comprar entrada" con su canal (para las estadísticas) y lleva a
 * la ticketera. El público compra ahí con el código de descuento TILCA del evento.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/r/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.redirect(new URL("/", request.url));

  const supabase = await createClient();
  const { data: ticketUrl, error } = await supabase.rpc("record_click", {
    p_event: id,
    p_channel: parseChannel(request.nextUrl.searchParams.get("c")),
    p_anon: request.cookies.get(ANON_COOKIE)?.value ?? null,
  });

  let target =
    !error && typeof ticketUrl === "string" && /^https?:\/\//.test(ticketUrl)
      ? new URL(ticketUrl)
      : new URL(`/evento/${id}`, request.url);

  // Con el simulador activado, los eventos con código TILCA venden en la ticketera de prueba
  // (así se puede probar el flujo completo sin comprar en una ticketera real).
  if (!error && TEST_TICKETING_ENABLED) {
    const { data: event } = await supabase.from("events").select("discount_code, source, price").eq("id", id).maybeSingle();
    if (event?.discount_code && !event.source && Number(event.price) > 0) target = new URL(`/ticketera/${id}`, request.url);
  }
  const response = NextResponse.redirect(target, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
