import { ImageResponse } from "next/og";

const SIZES = ["192", "512", "maskable-512", "apple-180"] as const;

export function generateStaticParams() {
  return SIZES.map((size) => ({ size }));
}

/** Íconos PNG para instalar TILCA como app (PWA). */
export async function GET(_req: Request, { params }: RouteContext<"/pwa-icon/[size]">) {
  const { size } = await params;
  if (!SIZES.includes(size as (typeof SIZES)[number])) return new Response("No encontrado", { status: 404 });
  const px = Number(size.replace(/\D/g, ""));
  const maskable = size.startsWith("maskable");
  const scale = maskable ? 0.62 : 0.8;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#17191E",
          borderRadius: maskable || size.startsWith("apple") ? 0 : px * 0.22,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", color: "#FFFFFF", fontSize: px * 0.62 * scale, fontWeight: 800 }}>
          t
          <div
            style={{
              width: px * 0.13 * scale,
              height: px * 0.13 * scale,
              borderRadius: 999,
              background: "#D1006B",
              marginLeft: px * 0.03 * scale,
            }}
          />
        </div>
      </div>
    ),
    { width: px, height: px },
  );
}
