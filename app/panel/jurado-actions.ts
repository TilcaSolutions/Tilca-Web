"use server";

import { redirect } from "next/navigation";
import { requireOrganizer } from "@/lib/organizer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { seedJuryData } from "@/scripts/seed-jury";
import { seedDemoData } from "@/scripts/seed";

/**
 * "Restablecer datos de ejemplo" (modo jurado): vuelve a cargar los datos de ejemplo y los
 * cobros reales en Testnet (lo mismo que `npm run seed && npm run seed:jurado`).
 * Solo desde la cuenta de ejemplo, y como mucho una vez cada 3 minutos.
 */
export async function resetJuryData() {
  const { organizer } = await requireOrganizer();
  if (!organizer.is_sample) redirect("/panel");

  const { data } = await createAdminClient().from("organizers").select("created_at").eq("id", organizer.id).single();
  if (data && Date.now() - new Date(data.created_at).getTime() < 3 * 60_000) redirect("/panel?restablecido=espera");

  await seedDemoData();
  await seedJuryData();

  // El seed recrea la cuenta de ejemplo: se vuelve a iniciar sesión con ella.
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({
    email: process.env.JURY_EMAIL || "demo@tilca.bo",
    password: process.env.JURY_PASSWORD || "tilca-demo-2026",
  });
  redirect("/panel?restablecido=1");
}
