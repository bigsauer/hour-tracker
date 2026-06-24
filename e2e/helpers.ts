import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getAdminClient(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getAnonClient(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL!;
  const key = process.env.VITE_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function clearAllEntries() {
  const admin = getAdminClient();
  await admin.from("entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}

export async function getUserId(email: string): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`User not found: ${email}`);
  return user.id;
}

export async function seedEntry(
  userId: string,
  startAt: string,
  endAt: string | null,
  location = "main",
) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("entries")
    .insert({
      user_id: userId,
      start_at: startAt,
      end_at: endAt,
      location,
      note: "",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function projectStorageKey(): string {
  const host = new URL(process.env.VITE_SUPABASE_URL!).hostname;
  const ref = host.split(".")[0];
  return `sb-${ref}-auth-token`;
}
