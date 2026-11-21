import type { Metadata } from "next";
import Link from "next/link";
import { getDemoBalances } from "@/app/demo/actions";
import { DemoInteractive } from "@/components/demo/DemoInteractive";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Stellar Demo | TILCA — National Startups Hackathon",
  description:
    "Demostración interactiva de liquidación de comisiones en Stellar Testnet con Trustless Work Escrow para el jurado de la hackathon.",
};

export default async function DemoPage() {
  const initialBalances = await getDemoBalances();

  return (
    <div className="min-h-screen bg-sand text-ink selection:bg-accent selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-sand/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="h-4 w-px bg-line" aria-hidden="true" />
            <span className="font-condensed text-sm font-bold tracking-wider uppercase text-accent">
              Stellar Testnet Demo ⚡
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/panel" className="btn-secondary h-9 px-3.5 text-xs font-semibold">
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
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/5 px-3 py-1 text-xs font-bold text-accent">
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            National Startups Hackathon by Stellar — Buidlers Bolivia
          </div>
          <h1 className="font-condensed mt-3 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            Liquidación de Comisiones con Escrow en Stellar
          </h1>
          <p className="mt-3 max-w-3xl text-base text-ink-2 leading-relaxed">
            TILCA cobra <strong className="text-ink font-semibold">Bs 5.00</strong> al organizador por cada asistente nuevo validado en puerta. 
            El público y los organizadores operan <strong className="text-ink font-semibold">100% en Bolivianos sin fricción cripto</strong>; 
            en segundo plano, los fondos se depositan en un <strong className="text-ink font-semibold">Smart Escrow de Trustless Work</strong> en Stellar Testnet y se liberan automáticamente por cada canje certificado.
          </p>
        </div>

        {/* 3 Pilares de la Solución */}
        <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-[10px] border border-line bg-surface p-4 shadow-xs">
            <div className="text-2xl mb-2">🇧🇴</div>
            <h3 className="m-0 text-sm font-bold text-ink">Cero fricción para el usuario</h3>
            <p className="mt-1 mb-0 text-xs text-ink-2 leading-relaxed">
              El público descubre eventos en el mapa y recibe un código corto. El organizador nunca gestiona llaves privadas ni maneja gas fees.
            </p>
          </div>

          <div className="rounded-[10px] border border-line bg-surface p-4 shadow-xs">
            <div className="text-2xl mb-2">🤝</div>
            <h3 className="m-0 text-sm font-bold text-ink">Trustless Work Escrow</h3>
            <p className="mt-1 mb-0 text-xs text-ink-2 leading-relaxed">
              Presupuesto bloqueado en Testnet. Cada canje exitoso de público nuevo libera un hito de Bs 5 directo a la billetera de TILCA.
            </p>
          </div>

          <div className="rounded-[10px] border border-line bg-surface p-4 shadow-xs">
            <div className="text-2xl mb-2">⚡</div>
            <h3 className="m-0 text-sm font-bold text-ink">Resiliencia y Plan B</h3>
            <p className="mt-1 mb-0 text-xs text-ink-2 leading-relaxed">
              Si Stellar tiene latencia o la red cae, el boletero aprueba la entrada al instante. El cobro se encola como pendiente sin bloquear la puerta.
            </p>
          </div>
        </section>

        {/* Componente Interactivo para el Jurado */}
        <DemoInteractive initialBalances={initialBalances} />

        {/* Ficha Técnica para el Jurado */}
        <section className="mt-12 rounded-[12px] border border-line bg-surface p-6">
          <h2 className="m-0 text-base font-bold text-ink flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-accent">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            Detalles Técnicos de la Integración para los Evaluadores
          </h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-ink-2 leading-relaxed">
            <div>
              <strong className="text-ink">Red Stellar:</strong> Testnet (Horizon oficial en{" "}
              <code>https://horizon-testnet.stellar.org</code>).
              <br />
              <strong className="text-ink">Smart Escrow:</strong> Trustless Work Multi-Release Smart Contract (Soroban).
              <br />
              <strong className="text-ink">Fondeo de Cuentas:</strong> Stellar Friendbot automatizado al registrar cada nuevo organizador.
            </div>
            <div>
              <strong className="text-ink">Cifrado de Llaves:</strong> AES-256-GCM con vector de inicialización único en base de datos.
              <br />
              <strong className="text-ink">Plan B (Fallback):</strong> Pago directo con TransactionBuilder + Memo de texto con el código del canje (máx. 28 bytes).
              <br />
              <strong className="text-ink">Explorador de Bloques:</strong> Enlaces directos a Stellar Expert para auditar cada transacción.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
