import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ANON_COOKIE } from "@/lib/constants";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Antes de cada página:
 * 1. refresca la sesión de Supabase (cookies),
 * 2. asigna un id anónimo a quien no tiene cuenta, para medir vistas y clics.
 */
export async function proxy(request: NextRequest) {
  let anonId = request.cookies.get(ANON_COOKIE)?.value;
  const isNewVisitor = !anonId;
  if (!anonId) {
    anonId = crypto.randomUUID();
    request.cookies.set(ANON_COOKIE, anonId);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  await supabase.auth.getClaims();

  if (isNewVisitor) {
    response.cookies.set(ANON_COOKIE, anonId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|pwa-icon|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
