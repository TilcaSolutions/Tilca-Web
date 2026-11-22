import { redirect } from "next/navigation";

/**
 * Ruta del modelo anterior (un código por clic). Hoy cada evento tiene un solo código de descuento,
 * que se ve en su ficha: los links viejos llevan ahí.
 */
export default async function OldCodePage({ searchParams }: PageProps<"/codigo/[code]">) {
  const { e } = await searchParams;
  redirect(typeof e === "string" && /^[0-9a-f-]{36}$/i.test(e) ? `/evento/${e}` : "/");
}
