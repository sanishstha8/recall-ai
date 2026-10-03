import {
  Atom,
  BookOpen,
  Brain,
  Briefcase,
  Code2,
  Database,
  FlaskConical,
  GraduationCap,
  Landmark,
  Library,
  type LucideIcon,
  Scale,
  Stethoscope,
} from "lucide-react";

import { cn } from "@/lib/utils";

export const KB_ICONS: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  database: Database,
  "code-2": Code2,
  brain: Brain,
  atom: Atom,
  "flask-conical": FlaskConical,
  briefcase: Briefcase,
  scale: Scale,
  stethoscope: Stethoscope,
  landmark: Landmark,
  library: Library,
};

export function KbIcon({ name, className }: { name: string; className?: string }) {
  const Icon = KB_ICONS[name] ?? BookOpen;
  return (
    <div
      className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand", className)}
    >
      <Icon className="size-[1.15rem]" />
    </div>
  );
}
