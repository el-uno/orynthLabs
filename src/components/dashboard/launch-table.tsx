import type { Launch } from "@/lib/types";

const statusStyles: Record<Launch["status"], string> = {
  draft: "bg-slate-500/20 text-slate-200",
  watching: "bg-amber-500/20 text-amber-200",
  ready: "bg-emerald-500/20 text-emerald-200",
  launched: "bg-sky-500/20 text-sky-200"
};

export function LaunchTable({ launches }: { launches: Launch[] }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Launch queue</h2>
          <p className="text-sm text-slate-400">
            Prioritized launches with scoring, status, and recency.
          </p>
        </div>
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950/50 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Chain</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {launches.map((launch) => (
              <tr key={launch.id} className="bg-white/[0.02]">
                <td className="px-4 py-4">
                  <div className="font-medium text-white">{launch.name}</div>
                  <div className="text-slate-400">{launch.symbol}</div>
                </td>
                <td className="px-4 py-4 text-slate-200">{launch.chain}</td>
                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide ${statusStyles[launch.status]}`}
                  >
                    {launch.status}
                  </span>
                </td>
                <td className="px-4 py-4 text-slate-200">{launch.score}</td>
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
