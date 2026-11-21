import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Crea tu cuenta" };

function safeNext(v: unknown) {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : null;
}

export default async function RegistroPage({ searchParams }: PageProps<"/registro">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const role = sp.rol === "organizador" ? "organizador" : "publico";

  const { user } = await getUser();
  if (user) redirect(role === "organizador" ? "/panel" : next ?? "/");

  const loginHref = `/entrar${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  return (
    <AuthLayout>
      <div>
        <h1 className="font-condensed m-0 text-[40px] leading-none font-extrabold tracking-[-0.5px]">Crea tu cuenta</h1>
        <p className="mt-2.5 mb-0 text-[15px] text-ink-2">
          ¿Ya tienes una?{" "}
          <Link href={loginHref} className="link-underline font-semibold text-ink">
            Inicia sesión
          </Link>
        </p>
      </div>
      <SignUpForm initialRole={role} next={next} />
    </AuthLayout>
  );
}
