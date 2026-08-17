import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { LaunchTable } from "@/components/dashboard/launch-table";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { SignalList } from "@/components/dashboard/signal-list";
import { launches, metricCards, signals } from "@/lib/mock-data";

export default function HomePage() {
  return (
    <AppShell
      title="Overview"
      subtitle="Alpha dashboard for launch intelligence, signals, and workflow control."
    >
      <div className="grid gap-6">
        <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-400/20 via-white/5 to-sky-400/10 p-8 shadow-2xl shadow-black/15">
            <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">
              Alpha scope
            </p>
            <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight">
              A credible four-week build for launch discovery, scoring, and
              server-side execution.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
              This slice stays intentionally narrow: ingest signals, rank
              opportunities, protect private keys behind the backend boundary,
              and surface the handful of actions the team needs to move quickly.
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
              <li>Frontend never handles poolCreator private keys.</li>
              <li>Launcher signs as payer through backend workflow services.</li>
              <li>Integration clients stay isolated in server-only modules.</li>
              <li>Workers can scale independently from the Next.js app.</li>
            </ul>
          </section>
        </section>

        <MetricGrid cards={metricCards} />

        <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <LaunchTable launches={launches} />
          <SignalList signals={signals} />
        </section>
      </div>
    </AppShell>
  );
}
