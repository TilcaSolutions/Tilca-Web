"use client";

import { startTransition, useActionState } from "react";
import { signIn, type AuthState } from "@/app/auth/actions";
import { GoogleButton } from "./GoogleButton";

export function SignInForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, {});
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="correo" className="label">
          Correo
        </label>
        <input id="correo" name="email" type="email" required autoComplete="email" placeholder="nombre@correo.com" className="field" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="clave" className="label">
          Contraseña
        </label>
        <input id="clave" name="password" type="password" required autoComplete="current-password" className="field" />
      </div>
      {state.error && (
        <p role="alert" className="m-0 rounded-control border border-warn-line bg-warn-bg px-3 py-2 text-sm text-warn-ink">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary h-12 text-base">
        {pending ? "Entrando…" : "Entrar"}
      </button>
      <GoogleButton next={next} />
    </form>
  );
}
