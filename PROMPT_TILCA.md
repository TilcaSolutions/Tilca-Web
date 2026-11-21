# Prompt para Claude Code: prototipo web de TILCA

Quiero que construyas un prototipo web funcional de **TILCA**, una plataforma para descubrir eventos culturales en La Paz, Bolivia (teatro, música, danza, stand up, exposiciones). Es para validar la idea con usuarios reales en un programa de incubación. No es un producto final: prioriza que funcione de punta a punta y se vea profesional, no que escale.

En la carpeta `mockups/` hay 5 pantallas en HTML que muestran el diseño exacto. Úsalas como referencia visual y de textos. Están escritas para otra herramienta: ignora `support.js`, `<x-dc>`, `<helmet>` y las variables `{{...}}`. Solo copia el diseño, la estructura y los textos.

Antes de escribir código, revisa los mockups y propón un plan corto: estructura de carpetas, modelo de datos y orden de trabajo. Espera mi OK y después avanza pantalla por pantalla.

## Quiénes lo usan

- **Público (B2C):** personas de 18 a 33 años que van a eventos culturales al menos una vez al mes. Pueden ver el mapa y los eventos **sin crear cuenta**. Con cuenta, pueden guardar eventos.
- **Organizador (B2B, el que paga):** compañías y organizadores independientes. Publican eventos y ven cuánta gente nueva les trae TILCA. Modelo: pagan **por cada asistente nuevo** que TILCA les trae (ejemplo: Bs 5 por asistente).

## Stack

- Next.js (App Router) con TypeScript y Tailwind
- Supabase para la base de datos, la autenticación (correo y contraseña, más Google) y el almacenamiento de afiches
- Leaflet con react-leaflet para el mapa. Usa tiles claros y sobrios, como CARTO Positron, para que coincida con el mockup.
- Deploy en Vercel. Que funcione bien en celular, porque la mayoría lo usará así, y que sea instalable como PWA.

## Diseño (respétalo)

- **Tipografía:** Archivo de Google Fonts, con los ejes `wdth` y `wght`. Títulos y afiches en versión condensada (`font-stretch: 62%–75%`, peso 800). El resto de la interfaz en ancho normal.
- **Colores:**
  - Tinta `#17191E`
  - Texto secundario `#4B505A`
  - Texto tenue `#6B707A`
  - Bordes `#E4E6EA`
  - Bordes de controles `#C8CCD2`
  - Fondo gris `#F4F5F7`
  - Superficie `#FFFFFF`
- **Acento único:** rosa `#D1006B`. Se usa solo en el botón principal de cada pantalla y en el punto del logo.
- **Afiches de categoría:**
  - Teatro `#C8102E`
  - Música `#F2B705` (con texto oscuro)
  - Danza `#1F7A4D`
  - Stand up `#1E7FC2`
  - Arte `#7A3FA0`
- **Gráficos:** azul `#2F5D8A`, de una sola serie.
- **Bordes redondeados:** 8px en controles, 12px en paneles y pastilla completa en los pines del mapa.
- **Logo:** la palabra "tilca" en minúsculas, condensada y con peso 800, seguida de un punto rosa.
- **Afiches generados:** si un evento no tiene afiche subido, genera uno tipográfico con el color de su categoría y el título en mayúsculas condensadas, igual que en los mockups.
- **Textos:** en español, en minúscula inicial y escritos desde el punto de vista del usuario. Evita etiquetas en mayúsculas y flechas en los botones.
- **Accesibilidad:** foco visible y contraste AA.

## Pantallas

1. **Inicio con mapa (`/`)**, ver `mockups/Main.dc.html`:
   - Arriba, el buscador y los filtros: Hoy / Este finde / Esta semana, las categorías y "Solo gratis".
   - A la izquierda, la lista de eventos con un afiche pequeño, lugar, fecha y precio.
   - A la derecha, el mapa con pines que muestran el precio. El pin seleccionado se ve en negro y abre una tarjeta del evento.
   - Los pines cercanos se agrupan en un círculo con el número de eventos.
   - En el celular, la lista y el mapa se alternan con un botón.
2. **Ficha del evento (`/evento/[id]`)**, ver `mockups/Evento.dc.html`:
   - Afiche, título y nombre de la compañía.
   - Fecha, lugar, cómo llegar y precio.
   - Descripción y cuántas personas lo guardaron.
   - Botones: "Comprar entrada", "Guardar" y "Compartir", que abre WhatsApp con el link.
   - Mapa con la ubicación.
3. **Registro (`/registro`)**, ver `mockups/Registro.dc.html`:
   - Al registrarse, la persona elige su rol: "Para ir a eventos" o "Para publicar mis eventos".
   - Según el rol, al terminar va al mapa o al panel del organizador.
4. **Organizador, mis eventos (`/panel`)**, ver `mockups/Organizador.dc.html`:
   - Un resumen de los últimos 30 días.
   - Un aviso cuando un evento vende lento.
   - Pestañas: Todos, Próximos, Borradores y Pasados.
   - Una tabla con vistas, clics en comprar y entradas atribuidas a TILCA.
   - El botón "Publicar un evento" abre un formulario: título, categoría, fecha y hora, lugar (elegido en el mapa), precio y preventa, aforo, descripción, afiche y link de compra.
5. **Organizador, estadísticas (`/panel/evento/[id]`)**, ver `mockups/Estadisticas.dc.html`:
   - Entradas vendidas contra el aforo.
   - El embudo: vistas, luego clics en comprar, luego compras.
   - Un gráfico de entradas por día.
   - De qué canal vino la gente (cartelera de WhatsApp, mapa, link de un amigo, búsqueda).
   - Cuántas entradas son de público nuevo y cuánto se paga a TILCA.
   - Un selector de periodo: "Últimos 7 días" o "Desde que se publicó".

## Lo más importante: medir lo que TILCA trae

Esto es lo que vamos a validar, así que tiene que funcionar de verdad:

- **Vistas:** registra cada vez que alguien abre la ficha de un evento, con un id anónimo si no tiene cuenta.
- **Clics en comprar:** "Comprar entrada" no lleva directo a la ticketera. Pasa por `/r/[eventoId]?c=[canal]`, que registra el clic y redirige al link del organizador. El parámetro `c` toma los valores `whatsapp`, `mapa`, `amigo` o `busqueda`. Los links que se comparten por WhatsApp llevan su canal.
- **Código TILCA:** cada clic genera un código corto, por ejemplo `TILCA-4F7K`, que se le muestra al usuario para que lo use al comprar. El organizador puede marcar ese código como "canjeado" desde su panel, o subir un CSV con los códigos usados. Así se cuentan las entradas atribuidas.
- **Público nuevo:** una entrada cuenta como público nuevo si ese usuario o ese teléfono no compró antes una entrada de ese organizador. Para el prototipo basta una casilla que el organizador marca al canjear el código.

## Datos de prueba

Crea un archivo de seed con:

- 15 a 20 eventos en La Paz, en lugares reales y con coordenadas reales: Teatro Municipal Alberto Saavedra Pérez, Museo Nacional de Arte, Espacio Simón I. Patiño, Thelonious Jazz Bar, Equinoccio, Centro Cultural de España y otros que encuentres.
- Fechas en las próximas 3 semanas.
- Un organizador de ejemplo, "Teatro de Altura", con 4 eventos y métricas parecidas a las de los mockups.

Todo lo de ejemplo tiene que quedar marcado como tal.

## Fuera de alcance por ahora

- Pagos dentro de la app y venta de entradas propia (la venta sigue en la ticketera del organizador)
- Notificaciones push
- La cartelera automática por WhatsApp. Por ahora, el aviso "Destacar en la cartelera" solo crea una solicitud que el equipo revisa a mano.

## Cómo saber que está listo

- Alguien sin cuenta abre el link en el celular, filtra "Este finde", toca un pin, abre la ficha y toca "Comprar". Queda registrada la vista y el clic con su canal, y la persona ve su código TILCA.
- Un organizador se registra, publica un evento con afiche y lo ve aparecer en el mapa.
- En las estadísticas de ese evento, los números cambian cuando simulo vistas, clics y códigos canjeados.
- Corre sin errores con `npm run build` y está desplegado en Vercel. El README explica cómo configurar Supabase.
