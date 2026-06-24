import {
  isAuthPasswordConfigured,
  isSupabaseConfigured,
} from "./lib/supabase";
import { AuthGate } from "./AuthGate";
import TimeClockApp from "./TimeClockApp";

function DeployConfigNotice() {
  const missing = [
    !isSupabaseConfigured() && "VITE_SUPABASE_URL",
    !isSupabaseConfigured() && "VITE_SUPABASE_ANON_KEY",
    !isAuthPasswordConfigured() && "VITE_AUTH_PASSWORD",
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-5">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-amber-500/5 px-5 py-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-amber-400 font-semibold mb-2">
          Configuration
        </div>
        <h1 className="text-xl font-semibold text-slate-50 mb-2">App is not configured</h1>
        <p className="text-sm text-slate-400 mb-4">
          This deployment is missing environment variables. Add them in the Vercel project
          settings (Production and Preview), then redeploy.
        </p>
        <ul className="text-sm text-slate-300 space-y-1 mb-4 font-mono">
          {missing.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">
          Vite embeds <code className="text-slate-400">VITE_*</code> vars at build time — a
          redeploy is required after adding them.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  if (!isSupabaseConfigured() || !isAuthPasswordConfigured()) {
    return <DeployConfigNotice />;
  }

  return (
    <AuthGate>
      <TimeClockApp />
    </AuthGate>
  );
}
