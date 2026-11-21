"use client";

import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Cliente para el navegador (subir afiches, guardar, iniciar sesión). */
export function createClient() {
  // Next reemplaza estas variables en el build; por eso se leen de forma literal.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder";
  client ??= createBrowserClient(url, key);
  return client;
}
