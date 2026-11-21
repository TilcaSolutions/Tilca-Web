# TILCA — MVP Cultural & Liquidación con Stellar Escrow

Prototipo para descubrir eventos culturales en La Paz (teatro, música, danza, stand up, arte) y medir cuánto público nuevo le trae TILCA a cada organizador, liquidando automáticamente comisiones en **Stellar Testnet** mediante smart escrows de **Trustless Work**.

- **Público:** mapa y lista de eventos sin cuenta; con cuenta, puede guardar eventos.
- **Organizadores:** publican eventos, eligen su presupuesto de promoción en Bolivianos (bloqueado en escrow en Testnet), validan códigos de asistentes y ven sus comprobantes verificados en Stellar.
- **Jurado / Hackathon:** pantalla interactiva en `/demo` con saldos de cuentas en vivo en Testnet y simulación del flujo de canje en tiempo real.

Stack: Next.js 16 (App Router, TypeScript, Tailwind 4), Supabase (PostgreSQL, RLS, Auth y Storage), Stellar SDK (`@stellar/stellar-sdk`), Trustless Work Escrow API, Leaflet con tiles Stadia Alidade Smooth (configurable con `NEXT_PUBLIC_MAP_TILE_URL`; en producción hay que registrar el dominio en Stadia), PWA instalable.

---

## Integración con Stellar Testnet (National Startups Hackathon)

Presentado para la **National Startups Hackathon by Stellar** (Buidlers Bolivia & Stellar Development Foundation).

### 1. El Modelo de Negocio en Stellar
- TILCA cobra **Bs 5.00** al organizador por cada asistente nuevo validado en puerta.
- **Cero fricción:** El público no ve cripto ni maneja billeteras. El organizador ve todo en Bolivianos (Bs) y no lidia con gas fees.
- **Smart Escrow (Trustless Work):** Al publicar un evento, el organizador asigna un presupuesto de promoción (ej. Bs 250 = 50 asistentes nuevos). Ese monto se deposita en un contrato de Escrow de múltiples liberaciones (Multi-Release) en Stellar Testnet.
- **Liberación por canje:** Al validar un código de público nuevo en el panel o boletería, se libera un hito de Bs 5 del Escrow hacia la cuenta recaudadora de TILCA, y el hash de la transacción queda registrado junto al canje con enlace directo a [Stellar Expert](https://stellar.expert/explorer/testnet).
- **Cierre y recuperación:** Al finalizar el evento, el saldo no consumido se devuelve íntegramente a la cuenta del organizador en Stellar.
- **Plan B y Resiliencia:** Si la conexión a Stellar falla o tiene latencia, el canje **nunca bloquea la puerta**. El asistente entra sin demora, el cobro queda en estado `pendiente` y se reintenta automáticamente en segundo plano. Si el contrato de escrow se traba, se activa el Plan B: pago directo con el código en el Memo (`TILCA-XXXX`).
- **Seguridad:** Las llaves privadas de los organizadores se cifran con **AES-256-GCM** (`STELLAR_ENCRYPTION_KEY`) y se guardan en `organizer_stellar_secrets`, una tabla que solo lee el servidor (service role). Los cobros se registran con funciones que solo puede llamar el servidor; un canje se reserva antes de pagar, así no se cobra dos veces.

### Estado real de la integración

- **Funciona en Testnet:** cada canje de público nuevo hace un pago real de la cuenta del organizador a la cuenta TILCA, con el código en el memo. El hash se guarda y abre en Stellar Expert. Testnet usa XLM, así que se envían 0.72 XLM como cifra simbólica por los Bs 5.
- **Todavía simulado:** el escrow de Trustless Work. Sin `TRUSTLESS_WORK_API_KEY` el ID del escrow es local, y "Agregar presupuesto" / "Cerrar evento y recuperar saldo" solo cambian el saldo en la base, sin mover fondos.
- El canje espera la respuesta de Stellar (unos segundos). Si falla, el canje vale igual y el cobro queda `pendiente` con el botón "Reintentar" en Presupuesto; no hay reintento automático.

---

## Cómo se mide lo que trae TILCA

| Qué | Cómo |
| --- | --- |
| Vistas | Al abrir `/evento/[id]` el navegador llama a `/api/vista`. Sin cuenta se usa un id anónimo (cookie `tilca_aid`). Las precargas no cuentan. |
| Canal | El link lleva `?c=mapa`, `busqueda`, `amigo` (compartir por WhatsApp) o `whatsapp` (cartelera). Se guarda en la vista y pasa al clic. |
| Clic en comprar | "Comprar entrada" lleva a `/r/[eventoId]?c=[canal]`: registra el clic, genera un código `TILCA-XXXX` y muestra el código con el botón hacia la ticketera del organizador. |
| Entradas atribuidas | En las estadísticas del evento, el organizador canjea códigos uno por uno o sube un CSV (columna `codigo` y, opcional, `nuevo` con sí/no). |
| Liquidación Stellar | Al canjear público nuevo, `cobrarCanje()` liquida Bs 5 en Stellar Testnet y almacena el `stellar_tx_hash`. |

---

## Pantallas Nuevas

1. **Presupuesto y cobros (`/panel/evento/[id]/presupuesto`):**
   - Depositado, usado y disponible en Bs con barra de progreso interactiva.
   - Lista de cobros con fecha, código, monto (Bs 5), estado y enlace *"Ver comprobante"* a `https://stellar.expert/explorer/testnet/tx/<hash>`.
   - Botón *"Agregar presupuesto"* (con selector rápido de montos e impacto en asistentes).
   - Botón *"Cerrar evento y recuperar saldo"* (reembolsa el remanente a la cuenta del organizador).
   - Botón *"Reintentar cobro"* para canjes que quedaron en estado pendiente.
2. **Paso de presupuesto al publicar evento (`/panel/evento/nuevo`):**
   - Selector interactivo de presupuesto promocional con cálculo en vivo de cuántos asistentes nuevos cubre.
3. **Demo interactiva para el jurado (`/demo`):**
   - Cuentas de Testnet de TILCA y del Organizador con sus saldos en vivo (XLM, BOBT/USDC).
   - Botón *"Simular canje completo"* para ejecutar y verificar transacciones en Testnet en vivo.
   - Switch de *"Simular caída de red"* para demostrar la resiliencia en puerta (el canje se aprueba y el cobro se encola).

---

## Correr en local

Requisitos: Node 20.9+ y Docker (para Supabase local).

```bash
npm install
npx supabase start        # levanta Supabase en Docker y aplica supabase/migrations
cp .env.example .env.local
# Completa .env.local con los valores de supabase y las llaves de Stellar
npm run seed              # datos de ejemplo iniciales
npm run migrate:stellar   # crea y fondea cuentas de Stellar Testnet para organizadores
npm run dev
```

### Comandos disponibles

- `npm run dev`: Inicia el servidor de desarrollo en `http://localhost:3000`.
- `npm run build`: Compila el proyecto Next.js 16 para producción.
- `npm run typecheck`: Validación completa de tipos con TypeScript.
- `npm run lint`: Chequeo de ESLint.
- `npm run seed`: Genera datos de prueba culturales de La Paz.
- `npm run import:superticket`: Importa los próximos eventos culturales de La Paz de Superticket (ver abajo). Con `-- --dry` solo muestra qué haría.
- `npm run migrate:stellar`: Genera llaves en Testnet, fondea con Friendbot y migra organizadores/eventos existentes.

Cuenta demo del organizador (Teatro de Altura): `demo@tilca.bo` / `tilca-demo-2026`.

---

## Eventos reales desde Superticket

`npm run import:superticket` lee la portada de superticket.bo y el bloque schema.org/Event de cada evento (el que la ticketera publica para Google), a una página por segundo. Pensado para correr una o dos veces al día.

- Quedan bajo el organizador **"Cartelera TILCA"** (cuenta de `IMPORT_OWNER_EMAIL`), que se revisa desde el panel normal.
- Se publica directo solo lo que se puede confirmar: lugar ubicado en La Paz, precio y categoría. Lo demás queda en **borrador con una nota** de qué revisar (se ve arriba del formulario al editarlo).
- Fuera: otras ciudades (por el título o el lugar; la dirección no se usa porque en La Paz hay calles Potosí, Sucre o Av. Mariscal Santa Cruz) y lo que no es agenda cultural (concursos, deporte, fiestas).
- **Ubicar un lugar una vez basta:** al publicar un evento importado, sus otras funciones se publican igual, y los borradores en el mismo lugar quedan ubicados. Las próximas importaciones ya entran ubicadas.
- Si un borrador no sirve, bórralo: no se vuelve a importar. Volver a correr el importador no duplica nada ni pisa lo que corregiste.
- En la ficha, "Comprar" registra el clic y lleva directo a Superticket (no hay código TILCA: Superticket no lo canjea, así que de estos eventos solo se miden vistas y clics, y no se cobra nada).
- Limitaciones: Superticket muestra `0.00` cuando el precio va por sectores, así que queda "por confirmar"; Todotix bloquea lectores automáticos (Cloudflare), así que no se importa. Antes de correrlo seguido, revisa los términos de Superticket o avísales.

---

## Variables de Entorno

Configurar en `.env.local`:

```ini
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_SIMULATOR=true

# Stellar Testnet & Trustless Work. Genera tus propias llaves; nunca las subas al repo.
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_STELLAR_PLATFORM_PUBLIC_KEY=G...   # cuenta TILCA (migrate:stellar la fondea si no existe)
STELLAR_PLATFORM_SECRET=S...
STELLAR_ENCRYPTION_KEY=                         # openssl rand -hex 32
TRUSTLESS_WORK_API_URL=https://api.trustlesswork.com
TRUSTLESS_WORK_API_KEY=
```

---

## Cómo Probar los Criterios de Evaluación

1. **Visita `/demo`:**
   - Observa las cuentas de Testnet y sus saldos en Horizon.
   - Haz clic en **"Simular canje completo"**: se emitirá una transacción en Testnet y verás el comprobante con enlace a Stellar Expert.
   - Activa **"Simular caída de red"** y haz clic en simular: comprueba que la entrada no se bloquea y queda en estado `pendiente`.
2. **Publicar un evento con Presupuesto:**
   - Inicia sesión con `demo@tilca.bo` / `tilca-demo-2026`.
   - Ve a `/panel/evento/nuevo`, completa los datos y elige Bs 250 de presupuesto (cubre 50 asistentes).
   - Publica el evento: queda con su presupuesto (el escrow de Trustless Work todavía es simulado, ver arriba).
3. **Validar Canjes y Presupuesto:**
   - En el panel del evento, ve a **"Presupuesto y cobros"**.
   - Canjea códigos como público nuevo: el presupuesto consumido aumentará en Bs 5 por cada uno, y se generará el enlace al explorador de Stellar.
   - Los canjes de ejemplo del seed quedan "pendientes": el botón **"Cobrar"** hace el pago real en Testnet.
   - **"Cerrar evento y recuperar saldo"** cierra la promoción en la base (el reembolso en Stellar es parte del escrow, todavía simulado).

---

## Estructura del Proyecto

```
app/
  page.tsx                         inicio: filtros, lista y mapa con glassmorphism
  demo/                            pantalla interactiva para el jurado de Stellar
  evento/[id]/                     ficha del evento con animación y badges
  r/[id]/route.ts                  clic en comprar: genera código TILCA
  codigo/[code]/                   muestra el código TILCA al usuario
  panel/                           panel del organizador:
    evento/[id]/                   estadísticas y tabla de códigos con enlaces Stellar
    evento/[id]/presupuesto/       gestión de presupuesto, escrow y cobros en Testnet
    pagos/                         resumen de liquidación y comisiones por evento
lib/
  stellar/                         módulo de Stellar Testnet & Trustless Work:
    config.ts                      parámetros de red, Horizon, Friendbot y Stellar Expert
    crypto.ts                      cifrado y descifrado AES-256-GCM para llaves privadas
    accounts.ts                    creación, fondeo y consulta de saldos en Horizon
    direct-payment.ts              Plan B: pagos directos con memo en Stellar Testnet
    trustless.ts                   integración con Multi-Release Escrow de Trustless Work
    payment.ts                     interfaz unificada cobrarCanje() y reintentarCobro()
supabase/migrations/
  20261120000000_tilca_schema.sql  esquema base de TILCA
  20261120010000_stellar_integration.sql migración de columnas y tablas de Stellar
scripts/
  seed.ts                          generación de datos culturales de prueba
  migrate-stellar.ts               migración y fondeo automático en Stellar Testnet
```
