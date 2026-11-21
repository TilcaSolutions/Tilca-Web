import type { Metadata } from "next";
import Link from "next/link";
import { EventForm } from "@/components/panel/EventForm";
import { requireOrganizer } from "@/lib/organizer";

export const metadata: Metadata = { title: "Publicar un evento" };

export default async function NewEventPage() {
  const { user } = await requireOrganizer();
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5">
      <div>
        <nav aria-label="Ruta" className="text-sm text-ink-2">
          <Link href="/panel" className="link-underline">
            Mis eventos
          </Link>{" "}
          <span aria-hidden="true">/</span> Publicar un evento
        </nav>
        <h1 className="font-condensed mt-2.5 mb-0 text-[40px] leading-none font-extrabold tracking-[-0.5px]">Publicar un evento</h1>
        <p className="mt-2 mb-0 text-[15px] text-ink-2">Al publicarlo aparece en el mapa de TILCA. Puedes guardarlo como borrador y terminarlo después.</p>
      </div>
      <EventForm userId={user.id} />
    </div>
  );
}
