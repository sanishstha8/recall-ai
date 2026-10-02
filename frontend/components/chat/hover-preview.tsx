"use client";

import { useRef, useState, type ReactNode } from "react";

import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

/** Lightweight hover preview (keeps the trigger a normal link for click/keyboard navigation). */
export function HoverCardish({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 250);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 120);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <span onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
          {trigger}
        </span>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        className="w-80 p-3"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
