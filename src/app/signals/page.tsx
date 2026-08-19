import { AppShell } from "@/components/layout/app-shell";
import { SignalList } from "@/components/dashboard/signal-list";
import { DataSourceBadge } from "@/components/dashboard/data-source-badge";
import { getDashboardData } from "@/server/queries/dashboard";

export const revalidate = 0;

export default async function SignalsPage() {
  const { signals, usingMockData } = await getDashboardData();

  return (
    <AppShell
      title="Signals"
      subtitle="Evidence across attention, builder, capital, consumer, and market-structure families."
    >
      <div className="grid gap-4">
        <div>
          <DataSourceBadge usingMockData={usingMockData} />
        </div>
        <SignalList signals={signals} />
      </div>
    </AppShell>
  );
}
