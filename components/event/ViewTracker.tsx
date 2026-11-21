"use client";

import { useEffect, useRef } from "react";

export function ViewTracker({ eventId, channel }: { eventId: string; channel: string | null }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    fetch("/api/vista", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, channel }),
      keepalive: true,
    }).catch(() => {
      // La medición nunca debe romper la página.
    });
  }, [eventId, channel]);
  return null;
}
