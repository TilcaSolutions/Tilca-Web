import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventForm } from "@/components/panel/EventForm";
import { deleteDraft } from "@/app/panel/evento/actions";
import { requireOrganizer } from "@/lib/organizer";
import { EVENT_COLUMNS, type TilcaEvent } from "@/lib/types";

export const metadata: Metadata = { title: "Editar evento" };

export default async function EditEventPage({ params }: PageProps<"/panel/evento/[id]/editar">) {
  const { id } = await params;
  const { supabase, user, organizer } = await requireOrganizer();
  const { data: event } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("id", id)
    .eq("organizer_id", organizer.id)
    .maybeSingle<TilcaEvent>();
  if (!event) notFound();
  const { data: imported } = event.source
    ? await supabase.from("events").select("source_url, import_notes").eq("id", id).maybeSingle()
    : { data: null };

  const isDraft = event.status === "borrador";
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5">
      <div>
        <nav aria-label="Ruta" className="text-sm text-ink-2">
          <Link href="/panel" className="link-underline">
            Mis eventos
          </Link>{" "}
          <span aria-hidden="true">/</span> {event.title}
        </nav>
        <div className="mt-2.5 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-condensed m-0 text-[40px] leading-none font-extrabold tracking-[-0.5px]">
            {isDraft ? "Terminar borrador" : "Editar evento"}
          </h1>
          {isDraft && (
            <form action={deleteDraft}>
              <input type="hidden" name="id" value={event.id} />
              <button type="submit" className="link-underline text-sm font-semibold text-ink-2 hover:text-ink">
                Borrar borrador
              </button>
            </form>
          )}
        </div>
      </div>
      {imported && (
        <section className="panel flex flex-col gap-2 border-l-4 border-l-warn-line p-4 text-sm" aria-label="Revisión del evento importado">
          <p className="m-0 text-ink">
            Importado de{" "}
            <a href={imported.source_url ?? "#"} target="_blank" rel="noopener noreferrer" className="link-underline font-semibold">
              Superticket
            </a>
            . {imported.import_notes ? "Antes de publicarlo, revisa:" : "Ya no queda nada por revisar."}
          </p>
          {imported.import_notes && (
            <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-ink-2">
              {imported.import_notes.split("\n").map((n: string) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          <p className="m-0 text-xs text-ink-3">Si no es un evento cultural de La Paz, bórralo: no se vuelve a importar.</p>
        </section>
      )}
      <EventForm event={event} userId={user.id} />
    </div>
  );
}
