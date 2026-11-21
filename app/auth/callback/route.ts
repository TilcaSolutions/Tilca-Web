import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Vuelta de Google (OAuth) y de los enlaces de confirmación por correo.
 * Si la persona eligió "Para publicar mis eventos", se vuelve organizadora.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const role = url.searchParams.get("rol");
  const nextParam = url.searchParams.get("next");
  const safeNext = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;

  const supabase = await createClient();
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/entrar?error=enlace", url.origin));
    }
  }

  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/entrar", url.origin));

  if (role === "organizador") {
    await supabase.rpc("become_organizer", {
      p_name: (data.user.user_metadata?.full_name as string | undefined) ?? null,
    });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  const fallback = profile?.role === "organizador" ? "/panel" : "/";
  return NextResponse.redirect(new URL(safeNext ?? fallback, url.origin));
}
