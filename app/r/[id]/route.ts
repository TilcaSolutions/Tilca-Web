import { NextResponse, type NextRequest } from "next/server";
import { ANON_COOKIE, parseChannel } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

/**
 * /r/[eventoId]?c=[canal]
 * Registra el clic en "Comprar entrada", genera el código TILCA y lleva a la
 * página que muestra el código con el botón hacia la ticketera del organizador
 * (o directo a la ticketera, si el evento se importó de ahí).
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/r/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.redirect(new URL("/", request.url));

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("record_click", {
      p_event: id,
      p_channel: parseChannel(request.nextUrl.searchParams.get("c")),
      p_anon: request.cookies.get(ANON_COOKIE)?.value ?? null,
    })
    .maybeSingle<{ code: string; ticket_url: string | null }>();

  if (error || !data) return NextResponse.redirect(new URL(`/evento/${id}`, request.url));

  // Eventos importados de una ticketera: la ticketera no canjea códigos TILCA,
  // así que el clic queda registrado y vamos directo a comprar.
  const { data: event } = await supabase.from("events").select("source").eq("id", id).maybeSingle();
  const target =
    event?.source && data.ticket_url?.startsWith("https://")
      ? new URL(data.ticket_url)
      : new URL(`/codigo/${data.code}?e=${id}`, request.url);

  const response = NextResponse.redirect(target, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
