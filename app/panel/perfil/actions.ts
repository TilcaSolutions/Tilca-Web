"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/lib/organizer";
import { parseProfile, type ProfileConfig } from "@/lib/profile/schema";

export interface ProfileSaveResult {
  ok: boolean;
  config?: ProfileConfig;
  message?: string;
}

/** Guarda el borrador (lo llama el editor solo, mientras se edita). No cambia el perfil público. */
export async function saveProfileDraft(raw: unknown): Promise<ProfileSaveResult> {
  const { supabase, organizer } = await requireOrganizer();
  const config = parseProfile(raw);
  const { error } = await supabase
    .from("organizer_profile_drafts")
    .upsert({ organizer_id: organizer.id, config, updated_at: new Date().toISOString() });
  if (error) return { ok: false, message: "No pudimos guardar el borrador." };
  return { ok: true, config };
}

/** "Publicar cambios": el borrador pasa a ser el perfil público. */
export async function publishProfile(raw: unknown): Promise<ProfileSaveResult> {
  const { supabase, organizer } = await requireOrganizer();
  const config = parseProfile(raw);
  const now = new Date().toISOString();
  const [pub, draft] = await Promise.all([
    supabase.from("organizer_profiles").upsert({ organizer_id: organizer.id, config, published_at: now }),
    supabase.from("organizer_profile_drafts").upsert({ organizer_id: organizer.id, config, updated_at: now }),
  ]);
  if (pub.error || draft.error) return { ok: false, message: "No pudimos publicar el perfil. Inténtalo de nuevo." };
  const { data } = await supabase.from("organizers").select("slug").eq("id", organizer.id).maybeSingle();
  if (data?.slug) revalidatePath(`/o/${data.slug}`);
  return { ok: true, config };
}

/** Nombre de la compañía (se usa en todo TILCA, no solo en el perfil). */
export async function renameOrganizer(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!name) return;
  const { supabase, organizer } = await requireOrganizer();
  await supabase.from("organizers").update({ name }).eq("id", organizer.id);
  revalidatePath("/", "layout");
}
