"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  FileText,
  GraduationCap,
  Loader2,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { DocumentTable } from "@/components/documents/document-table";
import { UploadDropzone } from "@/components/documents/upload-dropzone";
import { EmptyState, ErrorState } from "@/components/dashboard/states";
import { KbIcon } from "@/components/knowledge/kb-icon";
import { KnowledgeBaseFormDialog } from "@/components/knowledge/kb-form-dialog";
import { SemanticSearch } from "@/components/knowledge/semantic-search";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useKnowledgeBaseDocuments } from "@/hooks/use-documents";
import { useStartChat } from "@/hooks/use-start-chat";
import { knowledgeApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { useWorkspace } from "@/stores/workspace-store";

export default function KnowledgeBasePage() {
  const { id } = useParams<{ id: string }>();
  const kbId = Number(id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = useWorkspace();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const startChat = useStartChat();

  const kb = useQuery({ queryKey: qk.knowledgeBase(kbId), queryFn: () => knowledgeApi.get(kbId) });
  const docs = useKnowledgeBaseDocuments(kbId);
  const remove = useMutation({
    mutationFn: () => knowledgeApi.remove(kbId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      toast.success("Knowledge base deleted");
      router.replace("/dashboard/knowledge");
    },
  });

  if (kb.isPending)
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <Skeleton className="h-16 w-80" />
        <Skeleton className="h-40" />
      </div>
    );
  if (kb.error)
    return (
      <ErrorState className="m-8" title="Knowledge base unavailable" error={kb.error} onRetry={() => kb.refetch()} />
    );

  const documents = docs.data?.results ?? [];
  const readyCount = documents.filter((d) => d.status === "READY").length;
  const canContribute = can("MEMBER");

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <Link
        href="/dashboard/knowledge"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Knowledge
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <KbIcon name={kb.data.icon} className="size-12" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{kb.data.name}</h1>
            <p className="truncate text-sm text-muted-foreground">
              {kb.data.description || `${kb.data.document_count} documents · ${readyCount} ready`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => startChat.mutate({ knowledgeBaseId: kbId })}
            disabled={startChat.isPending || readyCount === 0}
            title={readyCount === 0 ? "Upload and process a document first" : undefined}
          >
            {startChat.isPending ? <Loader2 className="animate-spin" /> : <MessageSquarePlus />} Chat
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/dashboard/study?kb=${kbId}`}>
              <GraduationCap /> Study
            </Link>
          </Button>
          {canContribute && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Knowledge base actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <Pencil /> Edit details
                </DropdownMenuItem>
                {can("ADMIN") && (
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
        </TabsList>
        <TabsContent value="documents" className="mt-4 space-y-5">
          {canContribute && <UploadDropzone knowledgeBaseId={kbId} />}
          {docs.isPending ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : docs.error ? (
            <ErrorState error={docs.error} onRetry={() => docs.refetch()} />
          ) : documents.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents yet"
              description="Upload lecture notes, papers or books. They're processed and indexed locally."
            />
          ) : (
            <DocumentTable documents={documents} canEdit={canContribute} />
          )}
        </TabsContent>
        <TabsContent value="search" className="mt-4">
          <SemanticSearch knowledgeBaseId={kbId} hasDocuments={readyCount > 0} />
        </TabsContent>
      </Tabs>

      <KnowledgeBaseFormDialog open={editOpen} onOpenChange={setEditOpen} knowledgeBase={kb.data} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete “${kb.data.name}”?`}
        description="All documents, their search index, and study sets in this knowledge base will be permanently deleted."
        confirmLabel="Delete knowledge base"
        destructive
        onConfirm={() => remove.mutateAsync()}
      />
    </div>
  );
}
