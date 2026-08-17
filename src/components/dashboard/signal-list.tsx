import type { Signal } from "@/lib/types";

const severityStyles: Record<Signal["severity"], string> = {
  low: "text-sky-300",
  medium: "text-amber-300",
  high: "text-rose-300"
};

export function SignalList({ signals }: { signals: Signal[] }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/10">
      <h2 className="text-lg font-semibold">Signal stream</h2>
      <p className="text-sm text-slate-400">
        Lightweight feed from GitHub, X, market, on-chain, and partner data.
      </p>
      <div className="mt-5 space-y-3">
        {signals.map((signal) => (
          <article
            key={signal.id}
            className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-medium text-white">{signal.label}</h3>
                <p className="mt-1 text-sm text-slate-400">{signal.detail}</p>
              </div>
              <div className="text-right">
                <div className={`text-sm font-semibold ${severityStyles[signal.severity]}`}>
                  {signal.severity}
                </div>
                <div className="text-sm text-slate-300">{signal.value}</div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
