import Link from "next/link";
import { requestFeature } from "@/app/panel/actions";
import { weeksLabel, type SalesPace } from "@/lib/benchmark";

export function FeatureButton({
  eventId,
  requested,
  variant = "warn",
}: {
  eventId: string;
  requested: boolean;
  variant?: "warn" | "primary";
}) {
  if (requested) {
    return (
      <span role="status" className="flex-none text-sm font-semibold text-warn-ink">
        Solicitud enviada. La revisamos y te avisamos.
      </span>
    );
  }
  return (
    <form action={requestFeature} className="flex-none">
      <input type="hidden" name="event_id" value={eventId} />
      <button
        type="submit"
        className={
          variant === "primary"
            ? "btn-primary h-10 px-4 text-sm"
            : "flex h-9 items-center rounded-control border border-warn-strong px-3.5 text-sm font-semibold text-warn-ink hover:bg-accent/20"
        }
      >
        Destacar en la cartelera
      </button>
    </form>
  );
}

export function SlowSalesAlert({
  title,
  eventId,
  pace,
  requested,
}: {
  title: string;
  eventId: string;
  pace: SalesPace;
  requested: boolean;
}) {
  return (
    <div
      role="status"
      className="animate-fade-in flex flex-col gap-3 rounded-[10px] border border-warn-line bg-warn-bg px-[18px] py-3.5 shadow-xs transition-all sm:flex-row sm:items-center sm:gap-3.5"
    >
      <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-warn-strong/15 text-warn-strong">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <span className="flex-1 text-[15px] text-warn-ink">
        <Link href={`/panel/evento/${eventId}`} className="font-semibold hover:underline">
          {title} va lento:
        </Link>{" "}
        lleva el {pace.pct}% del aforo y {weeksLabel(pace.daysLeft)}. Eventos parecidos llegan al {pace.expected}% a esta altura.
      </span>
      <FeatureButton eventId={eventId} requested={requested} />
    </div>
  );
}
