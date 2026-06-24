import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "./lib/supabase";

const LAST_EMAIL_KEY = "timeclock:last-email";

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(LAST_EMAIL_KEY);
    if (saved) setEmail(saved);

    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event: string, next: Session | null) => {
      setSession(next);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    const password = import.meta.env.VITE_AUTH_PASSWORD;
    if (!password) {
      setMessage("App auth password is not configured on this deployment.");
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const supabase = getSupabase();
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });

    if (!signInError && signInData.session) {
      localStorage.setItem(LAST_EMAIL_KEY, trimmed);
      setSubmitting(false);
      return;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: trimmed,
      password,
    });

    setSubmitting(false);

    if (signUpError) {
      setMessage(signInError?.message ?? signUpError.message);
      return;
    }

    if (signUpData.session) {
      localStorage.setItem(LAST_EMAIL_KEY, trimmed);
      return;
    }

    setMessage(
      "Account created — disable email confirmation in Supabase Auth settings, then try again.",
    );
  };

  const signOut = async () => {
    await getSupabase().auth.signOut();
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-5">
        <form onSubmit={signIn} className="w-full max-w-sm">
          <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-400 font-semibold mb-2">
            On the Clock
          </div>
          <h1 className="text-2xl font-semibold text-slate-50 mb-2">Sign in</h1>
          <p className="text-sm text-slate-500 mb-6">Enter your email to continue.</p>
          <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2.5 text-sm text-slate-100 mb-4"
          />
          {message && <p className="text-sm text-red-400 mb-4">{message}</p>}
          <button
            type="submit"
            disabled={submitting || !email.trim()}
            className="w-full rounded-2xl bg-emerald-500 text-slate-950 py-3 text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Continue"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      <div className="fixed top-3 right-3 z-40">
        <button
          onClick={signOut}
          className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1"
        >
          Sign out
        </button>
      </div>
      {children}
    </>
  );
}
