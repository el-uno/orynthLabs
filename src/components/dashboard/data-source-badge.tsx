export function DataSourceBadge({ usingMockData }: { usingMockData: boolean }) {
  if (!usingMockData) {
    return (
      <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
        Live data
      </span>
    );
  }

  return (
    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
      Mock data — Supabase not configured
    </span>
  );
}
