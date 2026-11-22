# TILCA

**TILCA es la cartelera cultural de La Paz en un mapa.** El público ve qué hay cerca sin crear cuenta y compra en la ticketera del organizador con un código de descuento TILCA.
Publicar es gratis: el organizador paga solo el **5% de las entradas vendidas con ese código**.
Ese 5% se cobra desde un escrow en **Stellar Testnet**, con un comprobante público por cada movimiento.

**Estado: prototipo público en Stellar Testnet.**

| | |
| --- | --- |
| Sitio publicado | https://tilca.vercel.app |
| Para organizadores y modo jurado | https://tilca.vercel.app/organizadores |
| Recorrido en Stellar | https://tilca.vercel.app/demo |
| Comprobante real (comisión del 5%) | https://stellar.expert/explorer/testnet/tx/d61f82549e667d2689468aa7a15b75b2ea5768ef798f90f36f13335cff577c2d |
| Encuesta (solo lectura) | https://docs.google.com/spreadsheets/d/1DlWNGwtfAx4mhm2YZJgWdZyKnp3NRUm-eXLfDvDHswY/edit?usp=sharing |
| Deck | [COMPLETAR: link al deck] |

## El problema

Encuesta a público de eventos culturales en La Paz, con corte al 22/11: **67 respuestas** ([ver respuestas](https://docs.google.com/spreadsheets/d/1DlWNGwtfAx4mhm2YZJgWdZyKnp3NRUm-eXLfDvDHswY/edit?usp=sharing)).

- **60 de 67 (90%)** se enteraron de un evento cuando ya había pasado.
- **28** no fueron a un evento por no enterarse a tiempo.
- **39%** compra sus entradas en ticketeras.

La validación con organizadores está en [docs/entrevistas.md](docs/entrevistas.md).

## Para el jurado

**Entrar como jurado:** en https://tilca.vercel.app/organizadores toca **"Entrar como jurado"**. Entras sin registrarte al panel del organizador de ejemplo (Teatro de Altura), con eventos, ventas confirmadas y cobros ya cargados. También se puede entrar en https://tilca.vercel.app/entrar con `demo@tilca.bo` / `tilca-demo-2026`. Si los datos quedan desordenados, el aviso de modo jurado tiene un botón para restablecerlos.

Para probar una compra: abre un evento de pago, copia el código y toca "Comprar entrada". En el piloto, la compra se hace en una **ticketera de prueba** (no se cobra nada). Después, en el panel, "Confirmar ventas" muestra esa compra y se cierra el evento.

## Cómo se usa Stellar hoy

- **Escrow:** una cuenta de Stellar por cada evento de pago, **custodiada por TILCA**. Su llave privada se guarda cifrada (AES-256-GCM) en el servidor. No es un contrato inteligente y no usa Trustless Work.
- **Activo:** XLM de Testnet. Solo para la demo, 1 Bs se representa con 1 XLM, así las cifras de Stellar Expert coinciden con las del panel.
- **Flujo:**
  1. **Depósito.** Al publicar, el organizador deposita la comisión esperada (`ventas esperadas × precio × 5%`). Esa transacción crea la cuenta del escrow.
  2. **Liberación del 5%.** Al cerrar, el escrow paga a TILCA `entradas confirmadas × precio × 5%`.
  3. **Devolución y cierre.** Otra transacción devuelve el resto al organizador y cierra la cuenta (`accountMerge`).
- **Cierre:** lo hace el organizador desde el panel. **No hay cierre automático.** Si Stellar no responde, el evento queda "pendiente de cobro" y se reintenta sin pagar dos veces.

Direcciones públicas (Stellar Expert, Testnet):

- Cuenta de TILCA, que recibe las comisiones: [`GC3XDLZN3MROE5ANSOM4K3XXZWWPGZHAZBEQGBDNHN6BZ24FNJY4NDNA`](https://stellar.expert/explorer/testnet/account/GC3XDLZN3MROE5ANSOM4K3XXZWWPGZHAZBEQGBDNHN6BZ24FNJY4NDNA)
- Escrow de ejemplo, ya cerrado, del evento "El último tren": [`GBYN2574IROZUJUPYF4VSZYCXAFSOTLC77V6AVVTBHTELWCZRZYWHR7M`](https://stellar.expert/explorer/testnet/account/GBYN2574IROZUJUPYF4VSZYCXAFSOTLC77V6AVVTBHTELWCZRZYWHR7M)

Comprobantes de ese cierre (3 entradas × Bs 45):

- Depósito, Bs 22,50: https://stellar.expert/explorer/testnet/tx/48a3186235a52239762db3e77ebebff8987d98833ce9ffe3061fcf4eccf4dc29
- Comisión del 5% a TILCA, Bs 6,75: https://stellar.expert/explorer/testnet/tx/d61f82549e667d2689468aa7a15b75b2ea5768ef798f90f36f13335cff577c2d
- Devolución al organizador, Bs 15,75, y cierre de la cuenta: https://stellar.expert/explorer/testnet/tx/da38f1d372bccf78a6362479abc776f6be37d8c590c742b293f6a947c6f4a53e

## Ruta de Stellar a producción

Esto es un plan; nada de esta sección está implementado todavía.

- **Depósito sin cripto.** En el piloto, el organizador paga el presupuesto en Bs por QR y TILCA fondea el escrow. Después, una rampa Bs → stablecoin con un anchor (SEP-24).
- **De XLM a USDC.** Los montos pasan a un stablecoin en lugar de XLM con equivalencia ficticia.
- **Escrow sin custodia.** Migrar `lib/stellar/escrow.ts` a Trustless Work o a un contrato en Soroban, para que TILCA no tenga la llave.
- **Cierre automático.** Si el organizador no confirma en 7 días, TILCA propone un monto con lo medido y el organizador tiene 48 h para corregirlo o disputarlo.
- **Contra el subreporte.** Cruzar lo confirmado con los clics en "Comprar" y los códigos copiados que registra TILCA; a futuro, integración con la ticketera.

## Equipo

| Persona | Rol | Qué hizo en esta entrega |
| --- | --- | --- |
| Alexander | [COMPLETAR: rol] | Desarrollo de la app, integración con Stellar y despliegue. |
| Nicolás | [COMPLETAR: rol] | [COMPLETAR: p. ej. entrevistas, encuesta, storytelling] |
| Nahomi | [COMPLETAR: rol] | [COMPLETAR: lo que hizo] |
| [COMPLETAR: cuarto integrante] | [COMPLETAR: rol] | [COMPLETAR] |

Origen del código: el MVP se prototipó antes en local y este repositorio se creó el 21/11 para la entrega. [COMPLETAR: ajustar si no es así]

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
