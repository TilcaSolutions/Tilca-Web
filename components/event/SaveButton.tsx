"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  eventId: string;
  userId: string | null;
  initialSaved: boolean;
}

export function SaveButton({ eventId, userId, initialSaved }: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!userId) {
      router.push(`/entrar?next=${encodeURIComponent(`/evento/${eventId}`)}&motivo=guardar`);
      return;
    }
    setBusy(true);
    const next = !saved;
    setSaved(next);
    try {
      const supabase = createClient();
      const { error } = next
        ? await supabase.from("saves").insert({ user_id: userId, event_id: eventId })
        : await supabase.from("saves").delete().eq("user_id", userId).eq("event_id", eventId);
      if (error && error.code !== "23505") setSaved(!next);
    } catch {
      setSaved(!next);
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-control px-4 text-[15px] font-semibold transition-all duration-200 active:scale-95 ${
        saved
          ? "border-2 border-primary bg-primary/5 text-primary shadow-xs"
          : "border border-control bg-white hover:border-ink-3 hover:bg-fog text-ink"
      }`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        aria-hidden="true"
        className={`transition-transform duration-200 ${saved ? "scale-110 text-primary" : "text-ink"}`}
      >
        <path d="M6 3h12v18l-6-4-6 4z" />
      </svg>
      {saved ? "Guardado" : "Guardar"}
    </button>
  );
}
