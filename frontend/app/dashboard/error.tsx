"use client";

import { ErrorState } from "@/components/dashboard/states";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-6 md:p-8">
      <ErrorState title="This page crashed" error={error} onRetry={reset} />
    </div>
  );
}
