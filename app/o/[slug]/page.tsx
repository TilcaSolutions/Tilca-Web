import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Logo } from "@/components/Logo";
import { IntroAnimation } from "@/components/profile/IntroAnimation";
import { ProfileView } from "@/components/profile/ProfileView";
import { loadProfileEvents } from "@/lib/profile/data";
import { profileFontVars } from "@/lib/profile/fonts";
import { parseProfile } from "@/lib/profile/schema";
import { resolveTheme } from "@/lib/profile/themes";
import { createClient } from "@/lib/supabase/server";

const loadOrganizer = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data: organizer } = await supabase.from("organizers").select("id, name, slug").eq("slug", slug).maybeSingle();
  if (!organizer) return null;
  const { data: profile } = await supabase.from("organizer_profiles").select("config").eq("organizer_id", organizer.id).maybeSingle();
  // Sin perfil publicado (o con datos inválidos): el diseño por defecto.
  return { supabase, organizer, config: parseProfile(profile?.config) };
});

export async function generateMetadata({ params }: PageProps<"/o/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadOrganizer(slug);
  if (!data) return { title: "Perfil no encontrado" };
  const image = data.config.cover?.kind === "image" ? data.config.cover.url : data.config.avatar;
  return {
    title: data.organizer.name,
    description: data.config.tagline || `Eventos de ${data.organizer.name} en La Paz.`,
    openGraph: { title: data.organizer.name, images: image ? [image] : undefined },
  };
}

export default async function OrganizerProfilePage({ params }: PageProps<"/o/[slug]">) {
  const { slug } = await params;
  const data = await loadOrganizer(slug);
  if (!data) notFound();
  const { supabase, organizer, config } = data;
  const { upcoming, past } = await loadProfileEvents(supabase, organizer.id);
  const theme = resolveTheme(config);

  return (
    <div className={`${profileFontVars} flex min-h-dvh flex-col`} style={{ background: theme.bg }}>
      <nav aria-label="TILCA" className="flex h-14 flex-none items-center justify-between border-b border-line bg-surface px-4 sm:px-6">
        <Logo size={24} />
        <Link href="/" className="text-sm font-semibold text-primary underline-offset-2 hover:underline">
          Ver todos los eventos en el mapa
        </Link>
      </nav>
      <div className="flex-1">
        <ProfileView config={config} organizer={organizer} upcoming={upcoming} past={past} />
      </div>
      <IntroAnimation
        intro={config.intro}
        videoUrl={config.introVideo}
        slug={organizer.slug}
        name={organizer.name}
        accent={theme.accent}
        accentInk={theme.accentInk}
        fontFamily={theme.fontFamily}
      />
    </div>
  );
}
