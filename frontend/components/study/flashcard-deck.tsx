"use client";

import { ChevronLeft, ChevronRight, RotateCcw, Shuffle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Flashcard } from "@/types/api";

export function FlashcardDeck({ cards }: { cards: Flashcard[] }) {
  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  const [position, setPosition] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[order[position]];

  const move = useCallback(
    (delta: number) => {
      setFlipped(false);
      setPosition((p) => Math.min(Math.max(0, p + delta), cards.length - 1));
    },
    [cards.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, button")) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  if (!card) return null;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="tabular-nums">
          Card {position + 1} of {cards.length}
        </span>
        <Progress value={((position + 1) / cards.length) * 100} className="h-1.5 flex-1" />
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Show question" : "Show answer"}
        data-testid="flashcard"
        className="group block h-72 w-full [perspective:1600px] focus-visible:outline-none"
      >
        <div
          className={cn(
            "relative h-full w-full rounded-2xl transition-transform duration-500 [transform-style:preserve-3d]",
            flipped && "[transform:rotateY(180deg)]",
          )}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border bg-card p-8 text-center shadow-sm [backface-visibility:hidden] group-focus-visible:ring-2 group-focus-visible:ring-ring">
            <span className="mb-4 text-xs font-medium tracking-widest text-muted-foreground uppercase">Question</span>
            <p className="text-lg font-medium text-balance">{card.question}</p>
            <span className="absolute bottom-4 text-xs text-muted-foreground">Click or press space to flip</span>
          </div>
          <div className="absolute inset-0 flex [transform:rotateY(180deg)] flex-col items-center justify-center rounded-2xl border border-brand/30 bg-brand-soft/50 p-8 text-center [backface-visibility:hidden]">
            <span className="mb-4 text-xs font-medium tracking-widest text-brand uppercase">Answer</span>
            <p className="text-base text-balance">{card.answer}</p>
          </div>
        </div>
      </button>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => move(-1)} disabled={position === 0}>
          <ChevronLeft /> Previous
        </Button>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Shuffle"
            onClick={() => {
              setOrder((o) => [...o].sort(() => Math.random() - 0.5));
              setPosition(0);
              setFlipped(false);
            }}
          >
            <Shuffle />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Restart"
            onClick={() => {
              setPosition(0);
              setFlipped(false);
            }}
          >
            <RotateCcw />
          </Button>
        </div>
        <Button onClick={() => move(1)} disabled={position === cards.length - 1}>
          Next <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
