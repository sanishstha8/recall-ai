"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormError } from "@/components/forms/field";
import { STUDY_KINDS } from "@/components/study/meta";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { documentApi, knowledgeApi, studyApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/stores/workspace-store";
import type { Difficulty, StudyKind } from "@/types/api";

const ALL_DOCS = "all";

export function StudyGenerator({ initialKb, initialKind }: { initialKb?: number | null; initialKind?: StudyKind }) {
  const { current } = useWorkspace();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<StudyKind>(initialKind ?? "QUIZ");
  const [chosenKb, setKbId] = useState<number | null>(initialKb ?? null);
  const [documentId, setDocumentId] = useState<string>(ALL_DOCS);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");
  const meta = STUDY_KINDS.find((k) => k.kind === kind)!;
  const [count, setCount] = useState(meta.count?.default ?? 1);
  const [timeLimit, setTimeLimit] = useState(() => Math.ceil((meta.count?.default ?? 20) * 1.5));

  const kbs = useQuery({
    queryKey: qk.knowledgeBases(current?.id),
    queryFn: () => knowledgeApi.list({ workspace: current!.id }),
  });
  const readyKbs = (kbs.data?.results ?? []).filter((kb) => kb.ready_document_count > 0);
  // Default to the first knowledge base that has processed documents.
  const kbId = chosenKb ?? readyKbs[0]?.id ?? null;

  const docs = useQuery({
    queryKey: [...qk.documents(kbId ?? 0), "ready"],
    queryFn: () => documentApi.listForKnowledgeBase(kbId!, { status: "READY" }),
    enabled: !!kbId,
  });

  const selectKind = (next: StudyKind) => {
    const nextMeta = STUDY_KINDS.find((k) => k.kind === next)!;
    setKind(next);
    setCount(nextMeta.count?.default ?? 1);
    if (next === "MOCK_EXAM") setTimeLimit(Math.ceil((nextMeta.count?.default ?? 20) * 1.5));
  };

  const generate = useMutation({
    meta: { silent: true },
    mutationFn: () =>
      studyApi.generate(kind, {
        knowledge_base: kbId!,
        document: documentId === ALL_DOCS ? null : Number(documentId),
        topic: topic.trim(),
        count: meta.count ? count : undefined,
        difficulty,
        time_limit_minutes: kind === "MOCK_EXAM" ? timeLimit : undefined,
      }),
    onSuccess: (set) => {
      queryClient.invalidateQueries({ queryKey: ["study-sets"] });
      router.push(`/dashboard/study/${set.id}`);
    },
  });

  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-6 p-5 md:p-6">
        <div role="radiogroup" aria-label="What to generate" className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {STUDY_KINDS.map(({ kind: k, label, description, icon: Icon }) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => selectKind(k)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50",
                kind === k && "border-brand bg-brand-soft/60 hover:bg-brand-soft/60",
              )}
            >
              <Icon className={cn("size-4 text-muted-foreground", kind === k && "text-brand")} />
              <span className="text-sm font-medium">{label}</span>
              <span className="hidden text-xs text-muted-foreground md:block">{description}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="study-kb">Knowledge base</Label>
            <Select
              value={kbId ? String(kbId) : undefined}
              onValueChange={(v) => {
                setKbId(Number(v));
                setDocumentId(ALL_DOCS);
              }}
            >
              <SelectTrigger id="study-kb" className="w-full">
                <SelectValue placeholder={kbs.isPending ? "Loading…" : "Choose a knowledge base"} />
              </SelectTrigger>
              <SelectContent>
                {readyKbs.map((kb) => (
                  <SelectItem key={kb.id} value={String(kb.id)}>
                    {kb.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="study-doc">Document</Label>
            <Select value={documentId} onValueChange={setDocumentId} disabled={!kbId}>
              <SelectTrigger id="study-doc" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DOCS}>All documents</SelectItem>
                {docs.data?.results.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="study-topic">Focus topic (optional)</Label>
            <Input
              id="study-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. normalization, ACID, B+ trees"
              maxLength={300}
            />
          </div>
          {meta.count && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{meta.count.label}</Label>
                <span className="text-sm font-medium tabular-nums">{count}</span>
              </div>
              <Slider
                min={meta.count.min}
                max={meta.count.max}
                step={1}
                value={[count]}
                onValueChange={([v]) => setCount(v)}
                aria-label={meta.count.label}
              />
            </div>
          )}
          {kind !== "SUMMARY" && (
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <div role="radiogroup" aria-label="Difficulty" className="grid grid-cols-3 rounded-lg border p-0.5">
                {(["EASY", "MEDIUM", "HARD"] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={difficulty === d}
                    onClick={() => setDifficulty(d)}
                    className={cn(
                      "rounded-md py-1.5 text-sm text-muted-foreground capitalize transition-colors",
                      difficulty === d && "bg-primary text-primary-foreground",
                    )}
                  >
                    {d.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
          {kind === "MOCK_EXAM" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Time limit</Label>
                <span className="text-sm font-medium tabular-nums">{timeLimit} min</span>
              </div>
              <Slider
                min={5}
                max={180}
                step={5}
                value={[timeLimit]}
                onValueChange={([v]) => setTimeLimit(v)}
                aria-label="Time limit in minutes"
              />
            </div>
          )}
        </div>

        {generate.error && <FormError message={generate.error.message} />}
        <div className="flex flex-col-reverse items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Generated locally from your documents. On a CPU this usually takes 1–3 minutes.
          </p>
          <Button onClick={() => generate.mutate()} disabled={!kbId || generate.isPending} data-testid="generate-study">
            {generate.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate{" "}
            {meta.label.toLowerCase()}
          </Button>
        </div>
        {!kbs.isPending && !readyKbs.length && (
          <p className="text-sm text-muted-foreground">Upload and process at least one document to start studying.</p>
        )}
      </CardContent>
    </Card>
  );
}
