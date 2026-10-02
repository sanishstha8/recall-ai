"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { isProcessing } from "@/components/documents/status-badge";
import { documentApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import type { DocumentItem, Paginated } from "@/types/api";

const POLL_MS = 2500;

/** Documents in a knowledge base; polls while any document is still processing. */
export function useKnowledgeBaseDocuments(kbId: number) {
  return useQuery({
    queryKey: qk.documents(kbId),
    queryFn: () => documentApi.listForKnowledgeBase(kbId),
    refetchInterval: (query) =>
      (query.state.data as Paginated<DocumentItem> | undefined)?.results.some(isProcessing) ? POLL_MS : false,
  });
}

export function useDocument(id: number) {
  return useQuery({
    queryKey: qk.document(id),
    queryFn: () => documentApi.get(id),
    refetchInterval: (query) => (query.state.data && isProcessing(query.state.data) ? POLL_MS : false),
  });
}

function useInvalidateDocuments() {
  const queryClient = useQueryClient();
  return (kbId: number) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.documents(kbId) }),
      queryClient.invalidateQueries({ queryKey: ["documents", "recent"] }),
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] }),
      queryClient.invalidateQueries({ queryKey: qk.knowledgeBase(kbId) }),
    ]);
}

export function useReprocessDocument() {
  const invalidate = useInvalidateDocuments();
  return useMutation({
    mutationFn: (doc: DocumentItem) => documentApi.reprocess(doc.id),
    onSuccess: (doc) => {
      toast.success(`Reprocessing “${doc.name}”`);
      return invalidate(doc.knowledge_base);
    },
  });
}

export function useDeleteDocument() {
  const invalidate = useInvalidateDocuments();
  return useMutation({
    mutationFn: (doc: DocumentItem) => documentApi.remove(doc.id).then(() => doc),
    onSuccess: (doc) => {
      toast.success(`Deleted “${doc.name}”`);
      return invalidate(doc.knowledge_base);
    },
  });
}

export function useUploadDocument(kbId: number) {
  const invalidate = useInvalidateDocuments();
  return useMutation({
    mutationFn: (file: File) => documentApi.upload(kbId, file),
    meta: { silent: true }, // the uploader shows per-file errors inline
    onSettled: () => invalidate(kbId),
  });
}
