import { BookText, ClipboardCheck, Layers, ListChecks, type LucideIcon, MessageCircleQuestion } from "lucide-react";

import type { StudyKind } from "@/types/api";

export const STUDY_KINDS: {
  kind: StudyKind;
  label: string;
  description: string;
  icon: LucideIcon;
  count?: { min: number; max: number; default: number; label: string };
}[] = [
  { kind: "SUMMARY", label: "Summary", description: "Short + detailed summary and key points", icon: BookText },
  {
    kind: "FLASHCARDS",
    label: "Flashcards",
    description: "Question/answer cards you can flip",
    icon: Layers,
    count: { min: 3, max: 30, default: 10, label: "Cards" },
  },
  {
    kind: "QUIZ",
    label: "Quiz",
    description: "Multiple-choice questions with explanations",
    icon: ListChecks,
    count: { min: 3, max: 25, default: 10, label: "Questions" },
  },
  {
    kind: "QUESTIONS",
    label: "Questions",
    description: "Short- and long-answer practice questions",
    icon: MessageCircleQuestion,
    count: { min: 2, max: 20, default: 8, label: "Questions" },
  },
  {
    kind: "MOCK_EXAM",
    label: "Mock exam",
    description: "Timed exam, answers revealed after submitting",
    icon: ClipboardCheck,
    count: { min: 5, max: 50, default: 20, label: "Questions" },
  },
];

export const KIND_META = Object.fromEntries(STUDY_KINDS.map((k) => [k.kind, k])) as Record<
  StudyKind,
  (typeof STUDY_KINDS)[number]
>;
