"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/lib/organizer";

const AMOUNTS: Record<string, number> = { vistas: 10, clics: 3, canjes: 1 };

export async function simulate(formData: FormData) {
  if (process.env.NEXT_PUBLIC_ENABLE_SIMULATOR !== "true") return;
  const kind = String(formData.get("kind") ?? "");
  if (!(kind in AMOUNTS)) return;
  const { supabase } = await requireOrganizer();
  await supabase.rpc("simulate_activity", {
    p_event: String(formData.get("event_id") ?? ""),
    p_kind: kind,
    p_n: AMOUNTS[kind],
    p_channel: String(formData.get("channel") ?? "") || null,
  });
  revalidatePath("/panel", "layout");
}
