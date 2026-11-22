import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Publica tus eventos" };

async function becomeOrganizer(formData: FormData) {
  "use server";
  const name = String(formData.get("org_name") ?? "").trim();
  const { supabase, user } = await getUser();
  if (!user) redirect("/registro?rol=organizador");
  await supabase.rpc("become_organizer", { p_name: name || null });
  redirect("/panel");
}

/** Para quien ya tiene cuenta de público y quiere publicar eventos. */
export default async function OrganizadorPage() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/registro?rol=organizador");
  const { data: org } = await supabase.from("organizers").select("id").eq("owner_id", user.id).maybeSingle();
  if (org) redirect("/panel");

  return (
    <AuthLayout>
      <div>
        <h1 className="font-condensed m-0 text-[40px] leading-none font-extrabold tracking-[-0.5px]">Publica tus eventos</h1>
        <p className="mt-2.5 mb-0 text-[15px] leading-normal text-ink-2">
          Tu cuenta es para ir a eventos. Si también organizas, crea tu perfil de organizador: publicar es gratis y pagas solo el 5% de
          cada entrada que vendemos.
        </p>
      </div>
      <form action={becomeOrganizer} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="org_name" className="label">
            Nombre de tu compañía o proyecto
          </label>
          <input id="org_name" name="org_name" required className="field" autoComplete="organization" />
        </div>
        <button type="submit" className="btn-primary h-12 text-base">
          Crear perfil de organizador
        </button>
      </form>
    </AuthLayout>
  );
}
