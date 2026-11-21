# TILCA

Agenda cultural de La Paz con atribución de público. TILCA reúne en un mapa los eventos de teatro, música, danza, stand up y arte de la ciudad, y mide cuántos asistentes nuevos le trae a cada organizador. El organizador paga solo por resultados: **Bs 5 por cada asistente nuevo** verificado en puerta, liquidado en Stellar.

> Estado: MVP. Los pagos corren en **Stellar Testnet**.

## Cómo funciona

- **Público.** Explora eventos en mapa o lista, filtra por fecha y categoría, y compra en la ticketera del organizador. No necesita cuenta.
- **Atribución.** Cada vista y cada clic en "Comprar" se registra con su canal de origen (mapa, búsqueda, link compartido, cartelera de WhatsApp). El clic genera un código `TILCA-XXXX` que el asistente presenta en la entrada.
- **Organizadores.** Publican eventos, canjean los códigos (uno a uno o por CSV) e indican si el asistente es público nuevo. El panel muestra el embudo vistas → clics → entradas, canales y ritmo de ventas.
- **Liquidación.** Cada canje de público nuevo genera un pago en Stellar de la cuenta del organizador a la de TILCA, con el código en el memo y comprobante verificable en Stellar Expert.
- **Cartelera.** Los eventos de ticketeras (hoy, Superticket) se importan automáticamente y pasan por una revisión antes de publicarse.

## Stack

| Capa | Tecnología |
| --- | --- |
| Web | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, PWA |
| Datos y auth | Supabase: PostgreSQL con RLS, Auth (correo y Google), Storage |
| Mapa | Leaflet + react-leaflet, tiles Stadia Alidade Smooth |
| Pagos | Stellar SDK (Testnet); escrow de Trustless Work en preparación |

## Inicio rápido

Requisitos: Node 20.9+ y Docker.

```bash
npm install
npx supabase start            # Supabase local; aplica supabase/migrations
cp .env.example .env.local    # completa las variables (ver abajo)
npm run seed                  # datos de ejemplo
npm run migrate:stellar       # cuentas de Stellar Testnet para los organizadores
npm run dev                   # http://localhost:3000
```

Cuenta de organizador de ejemplo: `demo@tilca.bo` / `tilca-demo-2026`. Solo existe donde se corre `npm run seed`; no lo corras contra la base de producción.

## Configuración

Las variables van en `.env.local` (local) o en el proyecto de Vercel. `.env.example` tiene la plantilla.

| Variable | Descripción |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública de Supabase. |
| `SUPABASE_SECRET_KEY` | Clave secreta (service role). Solo servidor y scripts. |
| `NEXT_PUBLIC_SITE_URL` | URL pública del sitio (links de compartir y OAuth). |
| `NEXT_PUBLIC_ENABLE_SIMULATOR` | `true` muestra el simulador de actividad en el panel. Desactivar en producción. |
| `STELLAR_HORIZON_URL` | Servidor Horizon (por defecto, Testnet). |
| `NEXT_PUBLIC_STELLAR_PLATFORM_PUBLIC_KEY` | Cuenta de TILCA que recibe las comisiones. |
| `STELLAR_PLATFORM_SECRET` | Llave privada de esa cuenta. |
| `STELLAR_ENCRYPTION_KEY` | Cifra las llaves de los organizadores. Generar con `openssl rand -hex 32`. |
| `TRUSTLESS_WORK_API_URL`, `TRUSTLESS_WORK_API_KEY` | Escrow de Trustless Work (opcional). |
| `IMPORT_OWNER_EMAIL` | Cuenta que revisa los eventos importados. |
| `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` | Proveedor de tiles alternativo (opcional). |

Ninguna llave real debe subirse al repositorio.

## Scripts

| Comando | Uso |
| --- | --- |
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` / `npm start` | Build y servidor de producción. |
| `npm run lint` / `npm run typecheck` | ESLint y TypeScript. |
| `npm run seed` | Carga los datos de ejemplo (reemplaza los anteriores). |
| `npm run migrate:stellar` | Crea y fondea en Testnet la cuenta de TILCA y las de los organizadores que no la tengan. |
| `npm run import:superticket` | Importa eventos de Superticket. `-- --dry` muestra el resultado sin guardar. |

## Arquitectura

**Seguridad de datos.** Todas las tablas tienen RLS. El registro de vistas y clics, y el canje de códigos, pasan por funciones de Postgres que validan permisos. Las llaves privadas de Stellar se guardan cifradas (AES-256-GCM) en una tabla accesible solo desde el servidor.

**Pagos.** El cobro se reserva de forma atómica antes de enviar la transacción, de modo que un canje no se paga dos veces. Si Stellar no responde, el canje se acepta igual y el cobro queda pendiente para reintentarlo desde el panel.

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

- Los pagos corren en Stellar Testnet con XLM: se envía un monto simbólico por cada cobro de Bs 5.
- El escrow de Trustless Work aún no está integrado. El presupuesto de promoción se lleva en la base de datos; agregar presupuesto o cerrar la promoción no mueve fondos.
- Las entradas totales vendidas las reporta el organizador; TILCA no está conectado a las ticketeras.
- La curva de referencia de ventas ("eventos parecidos") es fija hasta tener datos históricos.
- Las coordenadas de los lugares de ejemplo son aproximadas.
- En los eventos importados de Superticket solo se miden vistas y clics: la ticketera no canjea códigos TILCA. Todotix bloquea la lectura automatizada y no se importa.
