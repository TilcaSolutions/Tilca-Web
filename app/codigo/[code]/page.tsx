import { redirect } from "next/navigation";

/**
 * Antes cada clic en "Comprar" generaba un código TILCA-XXXX con esta página.
 * Ahora cada evento tiene un solo código de descuento en su ficha: los links viejos van ahí.
 */
export default async function OldCodePage({ searchParams }: PageProps<"/codigo/[code]">) {
  const { e } = await searchParams;
  redirect(typeof e === "string" && /^[0-9a-f-]{36}$/i.test(e) ? `/evento/${e}` : "/");
}
