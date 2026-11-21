"use client";

import { startTransition, useActionState, useState } from "react";
import { signUp, type AuthState, type Role } from "@/app/auth/actions";
import { GoogleButton } from "./GoogleButton";

function RoleOption({
  value,
  current,
  onPick,
  title,
  text,
}: {
  value: Role;
  current: Role;
  onPick: (r: Role) => void;
  title: string;
  text: string;
}) {
  const on = current === value;
  return (
    <label
      className={`flex w-full cursor-pointer items-start gap-3.5 rounded-[10px] text-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
        on ? "border-2 border-ink bg-fog p-[15px]" : "border border-control bg-white p-4 hover:bg-fog"
      }`}
    >
      <input
        type="radio"
        name="role"
        value={value}
        checked={on}
        onChange={() => onPick(value)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={`mt-px h-5 w-5 flex-none rounded-full bg-white ${on ? "border-[6px] border-accent" : "border-2 border-[#8C929B]"}`}
      />
      <span className="flex flex-col gap-[3px] text-left">
        <span className="text-base font-semibold">{title}</span>
        <span className="text-sm leading-[1.4] text-ink-2">{text}</span>
      </span>
    </label>
  );
}

export function SignUpForm({ initialRole, next }: { initialRole: Role; next: string | null }) {
  const [role, setRole] = useState<Role>(initialRole);
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, {});

  if (state.info) {
    return (
      <div role="status" className="panel p-5 text-[15px] leading-normal">
        <p className="m-0 font-semibold">Revisa tu correo</p>
        <p className="mt-1 mb-0 text-ink-2">{state.info}</p>
      </div>
    );
  }

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
      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
        <legend className="mb-2.5 text-[15px] font-semibold">¿Para qué vas a usar TILCA?</legend>
        <RoleOption
          value="publico"
          current={role}
          onPick={setRole}
          title="Para ir a eventos"
          text="Guarda eventos y recibe la cartelera del finde."
        />
        <RoleOption
          value="organizador"
          current={role}
          onPick={setRole}
          title="Para publicar mis eventos"
          text="Llega a público nuevo y mira cuántas entradas te trae TILCA. Pagas solo por resultados."
        />
      </fieldset>

      {role === "organizador" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="org_name" className="label">
            Nombre de tu compañía o proyecto
          </label>
          <input id="org_name" name="org_name" required autoComplete="organization" placeholder="Teatro de Altura" className="field" />
        </div>
      )}
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
        <input
          id="clave"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Al menos 8 caracteres"
          className="field"
        />
      </div>

      {state.error && (
        <p role="alert" className="m-0 rounded-control border border-warn-line bg-warn-bg px-3 py-2 text-sm text-warn-ink">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary h-12 text-base">
        {pending ? "Creando tu cuenta…" : role === "organizador" ? "Crear cuenta de organizador" : "Crear cuenta"}
      </button>
      <GoogleButton role={role} next={next} />
      <p className="m-0 text-[13px] leading-normal text-ink-3">
        Al crear tu cuenta aceptas los términos de uso y la política de privacidad de TILCA.
      </p>
    </form>
  );
}
