import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center border-b border-line px-4 sm:px-6">
        <Logo />
      </header>
      <main className="mx-auto flex max-w-[480px] flex-1 flex-col justify-center gap-3 px-4 py-12">
        <h1 className="font-condensed m-0 text-[40px] leading-none font-extrabold tracking-[-0.5px]">No encontramos esta página</h1>
        <p className="m-0 text-[15px] text-ink-2">Puede que el evento ya no esté publicado o que el link esté incompleto.</p>
        <Link href="/" className="btn-primary mt-2 h-12 self-start px-5 text-base">
          Ver los eventos de esta semana
        </Link>
      </main>
    </div>
  );
}
