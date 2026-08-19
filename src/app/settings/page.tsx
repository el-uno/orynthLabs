import { AppShell } from "@/components/layout/app-shell";

const settings = [
  "Supabase/Postgres for app data",
  "pgvector for semantic and similarity search",
  "Redis for caching and lightweight queues",
  "Trigger.dev or BullMQ for background jobs",
  "OpenAI for ranking, extraction, and summaries",
  "Helius + Solana RPC for chain data",
  "GitHub and X integrations for off-chain signal capture"
];

export default function SettingsPage() {
  return (
    <AppShell
      title="Settings"
      subtitle="The stack and system choices behind the Founder OS alpha."
    >
      <section className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Configured stack</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {settings.map((item) => (
            <li
              key={item}
              className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-200"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
