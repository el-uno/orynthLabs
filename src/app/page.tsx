import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { LaunchTable } from "@/components/dashboard/launch-table";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { SignalList } from "@/components/dashboard/signal-list";
import { DataSourceBadge } from "@/components/dashboard/data-source-badge";
import { getDashboardData } from "@/server/queries/dashboard";

export const revalidate = 0;

export default async function HomePage() {
  const { launches, signals, metrics, usingMockData } = await getDashboardData();

  return (
    <AppShell
      title="Overview"
      subtitle="Opportunities, companies, and the evidence behind their readiness."
    >
      <div className="grid gap-6">
        <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-400/20 via-white/5 to-sky-400/10 p-8 shadow-2xl shadow-black/15">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">
                Alpha scope
              </p>
              <DataSourceBadge usingMockData={usingMockData} />
            </div>
            <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight">
              Know what to build. Build the right product. Design its economy.
              Launch it through Orynth. Grow the company.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
              Evidence is gathered across five families — attention, builder,
              capital, consumer and market structure — and readiness is only
              granted where independent families agree. &ldquo;Do not tokenize
              yet&rdquo; is a first-class answer.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/launches"
                className="rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-emerald-300"
              >
                View launches
              </Link>
              <Link
                href="/signals"
                className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Inspect signals
              </Link>
            </div>
          </div>

          <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-lg shadow-black/10">
            <h3 className="text-lg font-semibold">Architecture guardrails</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li>Status is decided by deterministic rules, not by the model.</li>
              <li>Corroboration means agreement across evidence families.</li>
              <li>Integration clients stay isolated in server-only modules.</li>
              <li>Workers can scale independently from the Next.js app.</li>
            </ul>
          </section>
        </section>

        <MetricGrid cards={metrics} />

        <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <LaunchTable launches={launches} />
          <SignalList signals={signals} />
        </section>
      </div>
    </AppShell>
  );
}
