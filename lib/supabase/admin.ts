import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * Cliente con la clave secreta (service role): salta RLS.
 * Solo para código de servidor que ya verificó quién es el usuario
 * (cobros en Stellar, llaves de los organizadores). Nunca importarlo desde un componente cliente.
 */
let admin: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") throw new Error("createAdminClient solo se usa en el servidor.");
  if (admin) return admin;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Falta SUPABASE_SECRET_KEY. Revisa .env.local (ver README).");
  admin = createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}
