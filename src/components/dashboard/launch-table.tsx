import { ScoreTrendCell } from "./score-trend";
import type { Launch, LaunchRecommendation, LaunchWithTrend } from "@/lib/types";

/** The tokenization call. "Not yet" is a real answer, so it gets real styling. */
const recommendationLabels: Record<LaunchRecommendation, string> = {
  launch_now: "Launch now",
  build_further: "Build further",
  do_not_tokenize: "Do not tokenize",
  insufficient_evidence: "Needs evidence"
};

const recommendationStyles: Record<LaunchRecommendation, string> = {
  launch_now: "bg-emerald-500/20 text-emerald-200",
  build_further: "bg-amber-500/20 text-amber-200",
  do_not_tokenize: "bg-rose-500/20 text-rose-200",
  insufficient_evidence: "bg-slate-500/20 text-slate-300"
};

const statusStyles: Record<Launch["status"], string> = {
  draft: "bg-slate-500/20 text-slate-200",
  watching: "bg-amber-500/20 text-amber-200",
  ready: "bg-emerald-500/20 text-emerald-200",
  launched: "bg-sky-500/20 text-sky-200"
};

export function LaunchTable({ launches }: { launches: LaunchWithTrend[] }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pipeline</h2>
          <p className="text-sm text-slate-400">
            Opportunities and companies, ranked by evidence, with score movement.
          </p>
        </div>
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950/50 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Entity</th>
              <th className="px-4 py-3 font-medium">Recommendation</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Trend</th>
              <th className="px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {launches.map((launch) => (
              <tr key={launch.id} className="bg-white/[0.02]">
                <td className="px-4 py-4">
                  <div className="font-medium text-white">{launch.name}</div>
                  <div className="text-slate-400">
                    {/* Most entities have no token; show what they are instead. */}
                    {launch.entityKind === "opportunity"
                      ? "Opportunity"
                      : (launch.symbol ?? "No token")}
                  </div>
                </td>
                <td className="px-4 py-4">
                  {launch.recommendation ? (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${recommendationStyles[launch.recommendation]}`}
                    >
                      {recommendationLabels[launch.recommendation]}
                    </span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide ${statusStyles[launch.status]}`}
                  >
                    {launch.status}
                  </span>
                </td>
                <td className="px-4 py-4 text-slate-200 tabular-nums">
                  {launch.score ?? <span className="text-slate-500">—</span>}
                </td>
                <td className="px-4 py-4">
                  <ScoreTrendCell trend={launch.trend} />
                </td>
                <td className="px-4 py-4 text-slate-400">
                  {new Date(launch.updatedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
