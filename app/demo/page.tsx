import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getDemoBalances } from "@/app/demo/actions";
import { DemoInteractive } from "@/components/demo/DemoInteractive";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Demo en Stellar | TILCA",
  description: "Recorrido completo del cobro de TILCA en Stellar Testnet: depósito en escrow, ventas confirmadas y cierre con comisión del 5%.",
};

export default async function DemoPage() {
  // Saldos en vivo: se leen en cada visita, no al compilar.
  await connection();
  const initialBalances = await getDemoBalances();

  return (
    <div className="min-h-screen bg-sand text-ink selection:bg-primary selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-sand/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden h-4 w-px bg-line sm:block" aria-hidden="true" />
            <span className="font-condensed hidden text-sm font-bold tracking-wider uppercase text-primary sm:inline">
              Demo en Stellar Testnet
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/panel" className="btn-secondary hidden h-9 px-3.5 text-xs font-semibold sm:inline-flex">
              Ir al panel de organizador
            </Link>
            <Link href="/" className="btn-primary h-9 px-3.5 text-xs font-semibold">
              Ver mapa en vivo
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Hero Section */}
        <div className="mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-bold text-primary">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            National Startups Hackathon by Stellar — Buidlers Bolivia
          </div>
          <h1 className="font-condensed mt-3 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            Cobro por resultados con escrow en Stellar
          </h1>
          <p className="mt-3 max-w-3xl text-base text-ink-2 leading-relaxed">
            Publicar en TILCA es gratis. El público compra en la ticketera de siempre con un{" "}
            <strong className="text-ink font-semibold">código de descuento TILCA</strong>, y TILCA cobra el{" "}
            <strong className="text-ink font-semibold">5% de cada entrada vendida con ese código</strong>. El organizador deposita la
            comisión esperada en un escrow en Stellar Testnet; al cerrar el evento, el escrow paga lo que corresponde y devuelve el
            resto. El público nunca ve nada de cripto.
          </p>
        </div>

        {/* 3 Pilares de la Solución */}
        <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-[10px] border border-line bg-surface p-4 shadow-xs">
            <div className="text-2xl mb-2">🇧🇴</div>
            <h3 className="m-0 text-sm font-bold text-ink">Cero fricción para el público</h3>
            <p className="mt-1 mb-0 text-xs text-ink-2 leading-relaxed">
              El público ve el evento en el mapa, copia el código y compra en la ticketera. El organizador trabaja en bolivianos y nunca maneja llaves ni comisiones de red.
            </p>
          </div>

          <div className="rounded-[10px] border border-line bg-surface p-4 shadow-xs">
            <div className="text-2xl mb-2">🤝</div>
            <h3 className="m-0 text-sm font-bold text-ink">Escrow por evento</h3>
            <p className="mt-1 mb-0 text-xs text-ink-2 leading-relaxed">
              Cada evento de pago tiene su cuenta de escrow. Al cerrar, libera ventas confirmadas × precio × 5% a TILCA y devuelve el resto al organizador.
            </p>
          </div>

          <div className="rounded-[10px] border border-line bg-surface p-4 shadow-xs">
            <div className="text-2xl mb-2">⚡</div>
            <h3 className="m-0 text-sm font-bold text-ink">Nunca bloquea al organizador</h3>
            <p className="mt-1 mb-0 text-xs text-ink-2 leading-relaxed">
              Si Stellar no responde, el evento se publica igual y el depósito o el cierre quedan pendientes, con un botón para reintentar.
            </p>
          </div>
        </section>

        {/* Componente Interactivo para el Jurado */}
        <DemoInteractive initialBalances={initialBalances} />

        {/* Ficha Técnica para el Jurado */}
        <section className="mt-12 rounded-[12px] border border-line bg-surface p-6">
          <h2 className="m-0 text-base font-bold text-ink flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-primary">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            Detalles técnicos
          </h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-ink-2 leading-relaxed">
            <div>
              <strong className="text-ink">Red Stellar:</strong> Testnet (Horizon oficial en{" "}
              <code>https://horizon-testnet.stellar.org</code>).
              <br />
              <strong className="text-ink">Escrow:</strong> una cuenta de Stellar por evento, controlada por TILCA. Al cerrar, paga la comisión, devuelve el saldo y se cierra (accountMerge).
              <br />
              <strong className="text-ink">Montos:</strong> 1 Bs = 1 XLM de prueba, así las cifras de Stellar Expert coinciden con las del panel.
            </div>
            <div>
              <strong className="text-ink">Cifrado de Llaves:</strong> AES-256-GCM con vector de inicialización único en base de datos.
              <br />
              <strong className="text-ink">Doble cobro:</strong> cada depósito y cada cierre reservan el evento de forma atómica, y un reintento no repite las transacciones que ya salieron.
              <br />
              <strong className="text-ink">Explorador de Bloques:</strong> Enlaces directos a Stellar Expert para auditar cada transacción.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
