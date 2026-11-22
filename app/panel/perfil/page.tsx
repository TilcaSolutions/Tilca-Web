import type { Metadata } from "next";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { requireOrganizer } from "@/lib/organizer";
import { loadProfileEvents } from "@/lib/profile/data";
import { profileFontVars } from "@/lib/profile/fonts";
import { parseProfile } from "@/lib/profile/schema";
import { renameOrganizer } from "./actions";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function ProfileEditorPage() {
  const { supabase, user, organizer } = await requireOrganizer();
  const [{ data: org }, { data: draft }, { data: published }, events] = await Promise.all([
    supabase.from("organizers").select("slug").eq("id", organizer.id).single(),
    supabase.from("organizer_profile_drafts").select("config").eq("organizer_id", organizer.id).maybeSingle(),
    supabase.from("organizer_profiles").select("config").eq("organizer_id", organizer.id).maybeSingle(),
    loadProfileEvents(supabase, organizer.id),
  ]);
  const publishedConfig = published ? parseProfile(published.config) : null;
  // Se edita el borrador; si no hay, lo publicado; si tampoco, el diseño por defecto.
  const initial = parseProfile(draft?.config ?? published?.config);

  return (
    <div className={`${profileFontVars} flex flex-col gap-5`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-condensed m-0 text-[40px] leading-none font-extrabold tracking-[-0.5px]">Mi perfil</h1>
          <p className="mt-2 mb-0 max-w-[62ch] text-[15px] text-ink-2">
            Tu página pública en <strong className="font-semibold text-ink">tilca/o/{org?.slug}</strong>. Diseñala a tu gusto: los cambios se
            guardan como borrador hasta que tocas “Publicar cambios”.
          </p>
        </div>
        <form action={renameOrganizer} className="flex items-end gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="label">Nombre de la compañía</span>
            <input name="name" required maxLength={80} defaultValue={organizer.name} className="field h-10 w-[240px]" />
          </label>
          <button type="submit" className="btn-secondary h-10 px-3.5 text-sm">
            Guardar nombre
          </button>
        </form>
      </div>
      <ProfileEditor
        userId={user.id}
        organizer={{ name: organizer.name, slug: org?.slug ?? "" }}
        initial={initial}
        published={publishedConfig}
        upcoming={events.upcoming}
        past={events.past}
      />
    </div>
  );
}
