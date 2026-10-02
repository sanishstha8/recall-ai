"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Field, FormError, TextField } from "@/components/forms/field";
import { KB_ICONS } from "@/components/knowledge/kb-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { knowledgeApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { cn } from "@/lib/utils";
import { type KnowledgeBaseValues, knowledgeBaseSchema } from "@/lib/validation/auth";
import { applyServerErrors } from "@/lib/validation/server-errors";
import { useWorkspace } from "@/stores/workspace-store";
import type { KnowledgeBase } from "@/types/api";

export function KnowledgeBaseFormDialog({
  open,
  onOpenChange,
  knowledgeBase,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  knowledgeBase?: KnowledgeBase;
}) {
  const { current } = useWorkspace();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const editing = !!knowledgeBase;

  const { register, handleSubmit, control, reset, setError, formState } = useForm<KnowledgeBaseValues>({
    resolver: zodResolver(knowledgeBaseSchema),
    defaultValues: { name: "", description: "", icon: "book-open" },
  });

  useEffect(() => {
    if (open) {
      setFormError(null);
      reset({
        name: knowledgeBase?.name ?? "",
        description: knowledgeBase?.description ?? "",
        icon: knowledgeBase?.icon ?? "book-open",
      });
    }
  }, [open, knowledgeBase, reset]);

  const save = useMutation({
    meta: { silent: true },
    mutationFn: (values: KnowledgeBaseValues) =>
      editing ? knowledgeApi.update(knowledgeBase.id, values) : knowledgeApi.create({ ...values, workspace: current!.id }),
    onSuccess: async (kb) => {
      await queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      queryClient.setQueryData(qk.knowledgeBase(kb.id), kb);
      onOpenChange(false);
      toast.success(editing ? "Knowledge base updated" : `“${kb.name}” created`);
      if (!editing) router.push(`/dashboard/knowledge/${kb.id}`);
    },
    onError: (error) => setFormError(applyServerErrors(error, setError, ["name", "description", "icon"])),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-5">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit knowledge base" : "New knowledge base"}</DialogTitle>
            <DialogDescription>Group related documents — a course, a project, a book series.</DialogDescription>
          </DialogHeader>
          <FormError message={formError} />
          <TextField id="kb-name" label="Name" placeholder="e.g. BSc CSIT" autoFocus error={formState.errors.name?.message} {...register("name")} />
          <Field id="kb-description" label="Description" error={formState.errors.description?.message}>
            <Textarea id="kb-description" rows={3} placeholder="What's inside? (optional)" {...register("description")} />
          </Field>
          <Field id="kb-icon" label="Icon">
            <Controller
              control={control}
              name="icon"
              render={({ field }) => (
                <div role="radiogroup" aria-label="Icon" className="grid grid-cols-6 gap-2">
                  {Object.entries(KB_ICONS).map(([key, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={field.value === key}
                      aria-label={key}
                      onClick={() => field.onChange(key)}
                      className={cn(
                        "flex h-10 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted",
                        field.value === key && "border-brand bg-brand-soft text-brand",
                      )}
                    >
                      <Icon className="size-4" />
                    </button>
                  ))}
                </div>
              )}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />}
              {editing ? "Save changes" : "Create knowledge base"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
