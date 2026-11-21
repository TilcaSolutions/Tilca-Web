import { redirect } from "next/navigation";
import { cache } from "react";
import { getUser } from "./supabase/server";

export interface Organizer {
  id: string;
  name: string;
  is_sample: boolean;
  stellar_public_key?: string | null;
}

/** Sesión del organizador actual. Redirige si no hay cuenta o no es organizador. */
export const requireOrganizer = cache(async () => {
  const { supabase, user } = await getUser();
  if (!user) redirect("/entrar?next=/panel");
  const { data: organizer } = await supabase
    .from("organizers")
    .select("id, name, is_sample, stellar_public_key")
    .eq("owner_id", user.id)
    .maybeSingle<Organizer>();
  if (!organizer) redirect("/organizador");
  return { supabase, user, organizer };
});

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
