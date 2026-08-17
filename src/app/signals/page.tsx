import { AppShell } from "@/components/layout/app-shell";
import { SignalList } from "@/components/dashboard/signal-list";
import { signals } from "@/lib/mock-data";

export default function SignalsPage() {
  return (
    <AppShell
      title="Signals"
      subtitle="Cross-source activity from GitHub, social, market, on-chain, and partner APIs."
    >
      <SignalList signals={signals} />
    </AppShell>
  );
}
