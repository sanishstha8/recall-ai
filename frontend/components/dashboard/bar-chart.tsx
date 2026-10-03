"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatNumber } from "@/lib/utils/format";

/** Minimal accessible daily bar chart (no chart library needed). */
export function DailyBarChart({
  data,
  days,
}: {
  data: { day: string; requests: number; total_tokens: number }[];
  days: number;
}) {
  const byDay = new Map(data.map((d) => [d.day, d]));
  const series = Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - (days - 1 - i));
    const key = date.toISOString().slice(0, 10);
    return { key, date, requests: byDay.get(key)?.requests ?? 0, tokens: byDay.get(key)?.total_tokens ?? 0 };
  });
  const max = Math.max(1, ...series.map((s) => s.requests));
  const fmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div>
      <div
        className="flex h-40 items-end gap-[3px]"
        role="img"
        aria-label={`AI requests per day over the last ${days} days`}
      >
        {series.map((s) => (
          <Tooltip key={s.key}>
            <TooltipTrigger asChild>
              <div className="flex h-full flex-1 items-end">
                <div
                  className="w-full rounded-t-[3px] bg-chart-1/85 transition-colors hover:bg-chart-1"
                  style={{ height: `${s.requests ? Math.max(4, (s.requests / max) * 100) : 0}%` }}
                />
                {!s.requests && <div className="h-px w-full bg-border" />}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {fmt.format(s.date)}: {s.requests} requests · {formatNumber(s.tokens)} tokens
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[0.7rem] text-muted-foreground">
        <span>{fmt.format(series[0].date)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
