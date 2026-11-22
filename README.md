# TILCA

**TILCA es la cartelera cultural de La Paz en un mapa.** Reúne teatro, música, danza, stand up y arte para que el público se entere de los eventos *antes* de que pasen.
Publicar es gratis: el organizador paga solo el **5% de cada entrada que se vende con su código de descuento TILCA**.
Ese 5% se cobra desde un escrow en **Stellar Testnet**, con un comprobante público por cada movimiento.

## Para el jurado

| | |
| --- | --- |
| Sitio publicado | https://tilca.vercel.app |
| Para organizadores | https://tilca.vercel.app/organizadores |
| Recorrido en Stellar | https://tilca.vercel.app/demo |
| Comprobante real (comisión del 5%) | https://stellar.expert/explorer/testnet/tx/d61f82549e667d2689468aa7a15b75b2ea5768ef798f90f36f13335cff577c2d |

**Entrar como jurado:** en https://tilca.vercel.app/organizadores toca **"Entrar como jurado"**. Entras sin registrarte al panel del organizador de ejemplo (Teatro de Altura), con eventos, ventas confirmadas y cobros ya cargados. También se puede entrar en https://tilca.vercel.app/entrar con `demo@tilca.bo` / `tilca-demo-2026`.

Para probar una compra: abre un evento de pago, copia el código y toca "Comprar entrada". En el piloto, la compra se hace en una **ticketera de prueba** (no se cobra nada). Después, en el panel, "Confirmar ventas" muestra esa compra y se cierra el evento.

## Cómo se usa Stellar

Cada evento de pago tiene **su propia cuenta de escrow en Stellar Testnet**. TILCA la controla y su llave privada se guarda cifrada en el servidor.

1. **Depósito.** Al publicar, el organizador deposita la comisión esperada (`ventas esperadas × precio × 5%`). Esa transacción crea la cuenta del escrow.
2. **Liberación del 5%.** Al cerrar el evento, el escrow paga a la cuenta de TILCA `entradas confirmadas × precio × 5%`.
3. **Devolución y cierre.** En otra transacción, el escrow devuelve el resto al organizador y se cierra (`accountMerge`).

El cierre lo hace el organizador desde el panel, no es automático. Si Stellar no responde, el evento queda "pendiente de cobro" y se puede reintentar sin pagar dos veces. Los montos se representan 1 Bs = 1 XLM de prueba, así las cifras de Stellar Expert coinciden con las del panel.

Comprobantes de un cierre real ("El último tren", 3 entradas × Bs 45):

- Depósito Bs 22,50: https://stellar.expert/explorer/testnet/tx/48a3186235a52239762db3e77ebebff8987d98833ce9ffe3061fcf4eccf4dc29
- Comisión del 5% a TILCA, Bs 6,75: https://stellar.expert/explorer/testnet/tx/d61f82549e667d2689468aa7a15b75b2ea5768ef798f90f36f13335cff577c2d
- Devolución al organizador, Bs 15,75, y cierre de la cuenta: https://stellar.expert/explorer/testnet/tx/da38f1d372bccf78a6362479abc776f6be37d8c590c742b293f6a947c6f4a53e

> El escrow lo custodia TILCA; no es un contrato inteligente. Integrar un escrow sin custodia, como Trustless Work, reemplazaría solo `lib/stellar/escrow.ts`.

## Cómo funciona

1. **Publicar.** El organizador crea en su ticketera (Superticket, Todotix, etc.) un código de descuento para TILCA, por ejemplo `TILCA10`, y publica el evento con ese código, dónde vende (ticketera, QR o transferencia, en puerta) y cuántas ventas espera de TILCA. Deposita en un escrow la comisión esperada: `ventas esperadas × precio × 5%` (30 entradas × Bs 80 × 5% = Bs 120).
2. **Vender.** El público encuentra el evento en el mapa, copia el código y compra en la ticketera de siempre (o lo muestra al pagar por QR o en puerta). Cada vista y cada clic en "Comprar" se registran con su canal (mapa, búsqueda, link de un amigo, cartelera de WhatsApp). El público nunca ve nada de cripto.
3. **Confirmar.** En "Confirmar ventas", el organizador escribe cuántas entradas se vendieron con el código según el reporte de su ticketera (con una captura o CSV de respaldo) y marca con "+1 vino por TILCA" las ventas en puerta. Puede confirmar varias veces; los montos se suman.
4. **Cerrar.** Al cerrar el evento, el escrow paga a TILCA `entradas confirmadas × precio × 5%` y devuelve el resto al organizador (12 × Bs 80 × 5% = Bs 48 a TILCA, Bs 72 de vuelta). Cada movimiento tiene su comprobante en Stellar Expert. Si el depósito no alcanza, se pide un depósito adicional antes de cerrar.

Los eventos gratis no tienen código, depósito ni cobro. Los eventos de ticketeras (hoy, Superticket) se importan automáticamente, pasan por una revisión y se publican sin código.

## Stack

| Capa | Tecnología |
| --- | --- |
| Web | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, PWA |
| Datos y auth | Supabase: PostgreSQL con RLS, Auth (correo y Google), Storage |
| Mapa | Leaflet + react-leaflet, tiles Stadia Alidade Smooth |
| Pagos | Stellar SDK (Testnet): un escrow por evento |

## Inicio rápido

Requisitos: Node 20.9+ y Docker.

```bash
npm install
npx supabase start            # Supabase local; aplica supabase/migrations
cp .env.example .env.local    # completa las variables (ver abajo)
npm run seed                  # datos de ejemplo
npm run migrate:stellar       # cuenta de TILCA y de los organizadores en Stellar Testnet
npm run seed:jurado           # depósitos y un cierre reales en Testnet para el modo jurado
npm run dev                   # http://localhost:3000
```

Cuenta de organizador de ejemplo: `demo@tilca.bo` / `tilca-demo-2026`. Solo existe donde se corre `npm run seed`. Córrelo en una base de demo, nunca en una con datos reales: borra y recrea los datos de ejemplo.

## Configuración

Las variables van en `.env.local` (local) o en el proyecto de Vercel. `.env.example` tiene la plantilla.

| Variable | Descripción |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública de Supabase. |
| `SUPABASE_SECRET_KEY` | Clave secreta (service role). Solo servidor y scripts. |
| `NEXT_PUBLIC_SITE_URL` | URL pública del sitio (links de compartir y OAuth). |
| `NEXT_PUBLIC_ENABLE_SIMULATOR` | `true` activa el simulador del panel y la ticketera de prueba (el botón "Comprar" lleva a ella). Solo para demos. |
| `STELLAR_HORIZON_URL` | Servidor Horizon (por defecto, Testnet). |
| `NEXT_PUBLIC_STELLAR_PLATFORM_PUBLIC_KEY` | Cuenta de TILCA que recibe las comisiones. |
| `STELLAR_PLATFORM_SECRET` | Llave privada de esa cuenta. |
| `STELLAR_ENCRYPTION_KEY` | Cifra las llaves de los organizadores y de los escrows. Generar con `openssl rand -hex 32`. |
| `IMPORT_OWNER_EMAIL` | Cuenta que revisa los eventos importados. |
| `JURY_EMAIL`, `JURY_PASSWORD` | Cuenta del modo jurado (opcional; por defecto, la de ejemplo). |
| `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` | Proveedor de tiles alternativo (opcional). |

Ninguna llave real debe subirse al repositorio.

## Scripts

| Comando | Uso |
| --- | --- |
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` / `npm start` | Build y servidor de producción. |
| `npm run lint` / `npm run typecheck` | ESLint y TypeScript. |
| `npm run seed` | Carga los datos de ejemplo (reemplaza los anteriores). |
| `npm run seed:jurado` | Después de `seed`: hace depósitos y un cierre reales en Testnet para que el modo jurado tenga comprobantes. |
| `npm run migrate:stellar` | Crea y fondea en Testnet la cuenta de TILCA y las de los organizadores que no la tengan (si no, se crean con el primer depósito). |
| `npm run import:superticket` | Importa eventos de Superticket. `-- --dry` muestra el resultado sin guardar. |

## Arquitectura

**Seguridad de datos.** Todas las tablas tienen RLS. Las vistas y los clics se registran con funciones de Postgres; las ventas confirmadas solo las escribe el dueño del evento y solo mientras el evento esté abierto. Los montos y el estado del escrow los escribe únicamente el servidor (un trigger impide cambiarlos desde el navegador). Las llaves privadas de Stellar se guardan cifradas (AES-256-GCM) en tablas accesibles solo desde el servidor.

**Escrow.** Cada evento de pago tiene su propia cuenta de Stellar, controlada por TILCA. El depósito la crea; al cerrar, una transacción paga la comisión a TILCA y otra devuelve el saldo al organizador y cierra la cuenta. Antes de cada depósito o cierre, el evento se reserva de forma atómica para que no se procese dos veces, y cada transacción confirmada se registra: un reintento no repite lo que ya salió. Si Stellar no responde, el evento se publica igual y el depósito o el cierre quedan pendientes, con un botón para reintentar. La comisión (`COMISION_TILCA = 0.05`) está en `lib/constants.ts`.

**Importación de eventos.** El importador lee los datos estructurados (schema.org/Event) que Superticket publica en cada evento. Publica directamente solo lo que puede confirmar: lugar ubicado en La Paz, precio y categoría. El resto queda como borrador con las observaciones a revisar. Las correcciones se conservan entre corridas y los borradores descartados no se vuelven a importar.

```
app/                 rutas: sitio público, panel del organizador, API
components/          UI, mapas y formularios
lib/                 dominio: formato, estadísticas, Stellar, importación, Supabase
scripts/             seed, migración a Stellar, importador
supabase/migrations/ esquema, políticas RLS y funciones
```

## Despliegue

1. **Supabase.** Crear el proyecto, vincularlo (`npx supabase link`) y aplicar el esquema con `npx supabase db push`. En Auth, configurar la URL del sitio y el redirect `https://<dominio>/auth/callback`. Para el login con Google, agregar las credenciales OAuth del proyecto de Google Cloud.
2. **Vercel.** Importar el repositorio y cargar las variables de entorno.
3. **Stellar.** Con las variables de producción, correr `npm run migrate:stellar`.
4. **Mapa.** Registrar el dominio en Stadia Maps (plan gratuito) o definir otro proveedor de tiles.
5. **Importación.** Programar `npm run import:superticket` una o dos veces al día (por ejemplo, con un cron).

## Estado y limitaciones

- Los pagos corren en Stellar Testnet con XLM de prueba: 1 Bs se representa con 1 XLM.
- El escrow es una cuenta de Stellar que custodia TILCA, no un contrato inteligente. Integrar un escrow sin custodia (por ejemplo, Trustless Work) reemplaza solo `lib/stellar/escrow.ts`.
- Las ventas con código las confirma el organizador con el reporte de su ticketera; TILCA no está conectado a las ticketeras.
- La comisión se calcula sobre el precio normal de la entrada, no sobre el de preventa.
- La curva de referencia de ventas ("eventos parecidos") es fija hasta tener datos históricos.
- Las coordenadas de los lugares de ejemplo son aproximadas.
- En los eventos importados de Superticket solo se miden vistas y clics: no tienen código ni cobro. Todotix bloquea la lectura automatizada y no se importa.
- Los datos del primer prototipo (un código por cada clic) se conservan en la base, pero ya no se generan ni se cuentan.
