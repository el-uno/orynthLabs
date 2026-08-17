import { AppShell } from "@/components/layout/app-shell";
import { LaunchTable } from "@/components/dashboard/launch-table";
import { DataSourceBadge } from "@/components/dashboard/data-source-badge";
import { getDashboardData } from "@/server/queries/dashboard";

export const revalidate = 0;

export default async function LaunchesPage() {
  const { launches, usingMockData } = await getDashboardData();

  return (
    <AppShell
      title="Launches"
      subtitle="Track scored opportunities and launch readiness in one place."
    >
      <div className="grid gap-4">
        <div>
          <DataSourceBadge usingMockData={usingMockData} />
        </div>
        <LaunchTable launches={launches} />
      </div>
    </AppShell>
  );
}
