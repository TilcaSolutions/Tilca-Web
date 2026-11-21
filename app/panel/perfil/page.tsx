import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/lib/organizer";

export const metadata: Metadata = { title: "Perfil de la compañía" };

async function saveProfile(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { supabase, organizer } = await requireOrganizer();
  await supabase.from("organizers").update({ name }).eq("id", organizer.id);
  revalidatePath("/", "layout");
}

export default async function PerfilPage() {
  const { organizer, user } = await requireOrganizer();
  return (
    <>
      <div>
        <h1 className="font-condensed m-0 text-[40px] leading-none font-extrabold tracking-[-0.5px]">Perfil de la compañía</h1>
        <p className="mt-2 mb-0 text-[15px] text-ink-2">El nombre aparece en la ficha de tus eventos y en los afiches generados.</p>
      </div>
      <form action={saveProfile} className="panel flex max-w-[560px] flex-col gap-4 p-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="label">
            Nombre de la compañía o proyecto
          </label>
          <input id="name" name="name" required defaultValue={organizer.name} className="field" />
        </div>
        <p className="m-0 text-sm text-ink-2">Cuenta: {user.email}</p>
        <button type="submit" className="btn-primary h-11 self-start px-5 text-[15px]">
          Guardar
        </button>
      </form>
    </>
  );
}
