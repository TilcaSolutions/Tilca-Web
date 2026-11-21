"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "publico" | "organizador";

export interface AuthState {
  error?: string;
  info?: string;
}

function destinationFor(role: Role, next?: string | null) {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return role === "organizador" ? "/panel" : "/";
}

function translateError(message: string) {
  if (/already registered|already been registered/i.test(message)) return "Ya existe una cuenta con ese correo. Inicia sesión.";
  if (/invalid login credentials/i.test(message)) return "El correo o la contraseña no coinciden.";
  if (/email not confirmed/i.test(message)) return "Confirma tu correo antes de entrar. Revisa tu bandeja.";
  if (/password/i.test(message)) return "La contraseña debe tener al menos 8 caracteres.";
  return "No pudimos completar el registro. Inténtalo de nuevo.";
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role: Role = formData.get("role") === "organizador" ? "organizador" : "publico";
  const orgName = String(formData.get("org_name") ?? "").trim();
  const next = String(formData.get("next") ?? "") || null;

  if (!email || !email.includes("@")) return { error: "Escribe un correo válido." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (role === "organizador" && !orgName) return { error: "Escribe el nombre de tu compañía o proyecto." };

  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, org_name: orgName || undefined },
      emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(destinationFor(role, next))}`,
    },
  });
  if (error) return { error: translateError(error.message) };
  if (!data.session) {
    return { info: `Te enviamos un correo a ${email}. Ábrelo para confirmar tu cuenta.` };
  }
  redirect(destinationFor(role, next));
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "") || null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: translateError(error?.message ?? "") };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  redirect(destinationFor((profile?.role as Role) ?? "publico", next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
