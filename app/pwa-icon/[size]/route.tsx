import { ImageResponse } from "next/og";
import { BRAND, CAT_VIEWBOX, catSvg } from "@/lib/brand";

const SIZES = ["192", "512", "maskable-512", "apple-180"] as const;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size }));
}

/** Íconos PNG para instalar TILCA como app (PWA): el gato de la marca sobre verde yungas. */
export async function GET(_req: Request, { params }: RouteContext<"/pwa-icon/[size]">) {
  const { size } = await params;
  if (!SIZES.includes(size as (typeof SIZES)[number])) return new Response("No encontrado", { status: 404 });
  const px = Number(size.replace(/\D/g, ""));
  const maskable = size.startsWith("maskable");
  // El ícono "maskable" se recorta en círculo: el gato va más chico para quedar dentro de la zona segura.
  const catWidth = px * (maskable ? 0.6 : 0.74);
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(catSvg(BRAND.logoCat))}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND.primary,
          borderRadius: maskable || size.startsWith("apple") ? 0 : px * 0.22,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse solo acepta <img> */}
        <img src={src} width={catWidth} height={(catWidth * CAT_VIEWBOX.height) / CAT_VIEWBOX.width} alt="" />
      </div>
    ),
    { width: px, height: px },
  );
}
