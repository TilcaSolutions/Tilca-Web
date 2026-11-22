"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * "Entrar como jurado": inicia sesión con la cuenta de organizador de ejemplo (la que crea
 * `npm run seed`). Sus datos son de prueba y se restablecen con `npm run seed && npm run seed:jurado`.
 */
export async function enterAsJury() {
  const email = process.env.JURY_EMAIL || "demo@tilca.bo";
  const password = process.env.JURY_PASSWORD || "tilca-demo-2026";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  redirect(error ? "/entrar?error=jurado" : "/panel");
}
