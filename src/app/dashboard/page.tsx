'use client';

import { SourcingTrigger, SourcingLog, useSourcingData } from './monitoring/_components/SourcingPanel';
import { MonitoringDashboard } from './monitoring/_components/MonitoringDashboard';

export default function DashboardPage() {
  const { runs, loading, triggering, hasRunning, runningStep, handleTrigger } = useSourcingData();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Monitoreo</h1>
        <SourcingTrigger
          triggering={triggering}
          hasRunning={hasRunning}
          runningStep={runningStep}
          onTrigger={handleTrigger}
        />
      </div>
      <MonitoringDashboard />
      <SourcingLog runs={runs} loading={loading} />
    </div>
  );
}
