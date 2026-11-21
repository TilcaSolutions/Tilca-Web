import Link from "next/link";
import { Suspense } from "react";
import { getUser } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { Logo } from "./Logo";
import { SearchBox } from "./SearchBox";

async function AccountNav() {
  const { supabase, user } = await getUser();
  if (!user) {
    return (
      <>
        <Link
          href="/registro?rol=organizador"
          className="hidden rounded-control px-3.5 py-2 text-[15px] font-medium text-ink-2 transition-colors hover:bg-fog hover:text-ink sm:block"
        >
          Publicar un evento
        </Link>
        <Link href="/entrar" className="btn-secondary h-10 px-4 text-[15px]">
          Iniciar sesión
        </Link>
      </>
    );
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isOrganizer = profile?.role === "organizador";
  return (
    <>
      {isOrganizer ? (
        <Link
          href="/panel"
          className="hidden rounded-control px-3.5 py-2 text-[15px] font-medium text-ink-2 transition-colors hover:bg-fog hover:text-ink sm:block"
        >
          Mi panel
        </Link>
      ) : (
        <Link
          href="/guardados"
          className="hidden rounded-control px-3.5 py-2 text-[15px] font-medium text-ink-2 transition-colors hover:bg-fog hover:text-ink sm:block"
        >
          Mis guardados
        </Link>
      )}
      <form action={signOut}>
        <button type="submit" className="btn-secondary h-10 px-4 text-[15px]">
          Salir
        </button>
      </form>
    </>
  );
}

export function SiteHeader({ live = false }: { live?: boolean }) {
  return (
    <header className="glass-header sticky top-0 z-40 flex h-16 flex-none items-center gap-3 border-b border-line/80 px-4 sm:gap-7 sm:px-6">
      <Logo />
      <Suspense fallback={<div className="h-10 flex-1 sm:max-w-[440px]" />}>
        <SearchBox live={live} />
      </Suspense>
      <nav aria-label="Cuenta" className="ml-auto flex flex-none items-center gap-2">
        <Suspense fallback={<span className="h-10 w-28" />}>
          <AccountNav />
        </Suspense>
      </nav>
    </header>
  );
}
