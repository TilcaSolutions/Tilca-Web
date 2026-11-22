import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SignInForm } from "@/components/auth/SignInForm";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Inicia sesión" };

function safeNext(v: unknown) {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : null;
}

export default async function EntrarPage({ searchParams }: PageProps<"/entrar">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const { user } = await getUser();
  if (user) redirect(next ?? "/");

  const signupHref = `/registro${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  return (
    <AuthLayout>
      <div>
        <h1 className="font-condensed m-0 text-[40px] leading-none font-extrabold tracking-[-0.5px]">Inicia sesión</h1>
        <p className="mt-2.5 mb-0 text-[15px] text-ink-2">
          ¿Todavía no tienes cuenta?{" "}
          <Link href={signupHref} className="link-underline font-semibold text-ink">
            Créala aquí
          </Link>
        </p>
      </div>
      {sp.motivo === "guardar" && (
        <p role="status" className="m-0 rounded-control bg-fog px-3 py-2 text-sm text-ink-2">
          Para guardar eventos necesitas una cuenta. Ver el mapa y los eventos no la necesita.
        </p>
      )}
      {sp.error === "enlace" && (
        <p role="alert" className="m-0 rounded-control border border-warn-line bg-warn-bg px-3 py-2 text-sm text-warn-ink">
          El enlace venció o ya se usó. Inicia sesión de nuevo.
        </p>
      )}
      {sp.error === "jurado" && (
        <p role="alert" className="m-0 rounded-control border border-warn-line bg-warn-bg px-3 py-2 text-sm text-warn-ink">
          La cuenta de ejemplo no está disponible. Hay que cargar los datos de prueba (npm run seed).
        </p>
      )}
      <SignInForm next={next} />
    </AuthLayout>
  );
}
