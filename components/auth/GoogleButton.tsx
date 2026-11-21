"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GoogleButton({ role, next }: { role?: "publico" | "organizador"; next?: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (role) params.set("rol", role);
      if (next) params.set("next", next);
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?${params}` },
      });
      if (error) {
        setBusy(false);
        setError("Google no está disponible ahora. Usa tu correo o inténtalo más tarde.");
      }
    } catch {
      setBusy(false);
      setError("No pudimos conectar con Google. Revisa tu conexión o usa tu correo.");
    }
  }

  return (
    <>
      <button type="button" onClick={go} disabled={busy} className="btn-secondary h-12 w-full gap-2.5 text-[15px]">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" />
        </svg>
        Continuar con Google
      </button>
      {error && (
        <p role="alert" className="m-0 text-sm text-warn-ink">
          {error}
        </p>
      )}
    </>
  );
}
