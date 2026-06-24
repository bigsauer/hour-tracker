import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { projectStorageKey } from "./helpers";

export default async function globalSetup() {
  const url = process.env.VITE_SUPABASE_URL!;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const email = process.env.E2E_TEST_EMAIL!;

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const secondEmail = `e2e-second-${Date.now()}@example.com`;
  await admin.auth.admin.createUser({
    email: secondEmail,
    email_confirm: true,
  });
  process.env.E2E_SECOND_EMAIL = secondEmail;

  const existing = await admin.auth.admin.listUsers();
  const found = existing.data.users.find((u) => u.email === email);
  if (!found) {
    await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
  }

  await admin.from("entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError) throw linkError;

  const tokenHash = linkData.properties?.hashed_token;
  if (!tokenHash) throw new Error("No hashed_token from generateLink");

  const { data: sessionData, error: verifyError } = await anon.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });
  if (verifyError) throw verifyError;
  if (!sessionData.session) throw new Error("No session after verifyOtp");

  const authDir = resolve(process.cwd(), "e2e/.auth");
  await mkdir(authDir, { recursive: true });

  const storageKey = projectStorageKey();
  const sessionPayload = {
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
    expires_at: sessionData.session.expires_at,
    expires_in: sessionData.session.expires_in,
    token_type: sessionData.session.token_type,
    user: sessionData.session.user,
  };

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: "http://127.0.0.1:5173",
        localStorage: [
          {
            name: storageKey,
            value: JSON.stringify(sessionPayload),
          },
        ],
      },
    ],
  };

  await writeFile(resolve(authDir, "user.json"), JSON.stringify(storageState, null, 2));
}
