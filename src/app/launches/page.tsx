import { AppShell } from "@/components/layout/app-shell";
import { LaunchTable } from "@/components/dashboard/launch-table";
import { launches } from "@/lib/mock-data";

export default function LaunchesPage() {
  return (
    <AppShell
      title="Launches"
      subtitle="Track scored opportunities and launch readiness in one place."
    >
      <LaunchTable launches={launches} />
    </AppShell>
  );
}
