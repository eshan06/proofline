"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiClientError } from "@/lib/api-client";
import { toast } from "@/stores/toasts";
import type { Workspace } from "@/lib/schemas";

export const WORKSPACE_KEY = ["workspace"] as const;

/**
 * One coherent, session-scoped cache for the whole workspace. At fixture
 * scale this is the simplest correct way to guarantee that a status change
 * made in the inbox is instantly visible on the board, the table, and the
 * customer profile — a hard requirement ("single source of truth per
 * ticket"). Mutations stay entity-granular at the API boundary.
 */
export function useWorkspace(initialData?: Workspace) {
  return useQuery({
    queryKey: WORKSPACE_KEY,
    queryFn: api.workspace,
    initialData,
  });
}

interface OptimisticContext {
  previous: Workspace | undefined;
}

/**
 * Mutation wrapper implementing the optimistic-update-with-rollback contract:
 * apply `optimistic` to the cached workspace immediately, roll back on error
 * (with the server's message as a toast), refetch on settle.
 */
export function useWorkspaceMutation<TVars>(opts: {
  mutationFn: (vars: TVars) => Promise<unknown>;
  optimistic?: (ws: Workspace, vars: TVars) => Workspace;
  onSuccessToast?: (vars: TVars) => string | null;
  onErrorToast?: (err: Error, vars: TVars) => string | null;
  /** Skip the automatic refetch (for flows that orchestrate their own). */
  skipInvalidate?: boolean;
  onSuccess?: (data: unknown, vars: TVars) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, TVars, OptimisticContext>({
    mutationFn: opts.mutationFn,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: WORKSPACE_KEY });
      const previous = queryClient.getQueryData<Workspace>(WORKSPACE_KEY);
      if (previous && opts.optimistic) {
        queryClient.setQueryData<Workspace>(WORKSPACE_KEY, opts.optimistic(previous, vars));
      }
      return { previous };
    },
    onError: (err, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(WORKSPACE_KEY, context.previous);
      }
      const msg =
        opts.onErrorToast?.(err, vars) ??
        (err instanceof ApiClientError ? err.message : "Something went wrong — change rolled back");
      if (msg) toast(msg);
    },
    onSuccess: (data, vars) => {
      const msg = opts.onSuccessToast?.(vars);
      if (msg) toast(msg);
      opts.onSuccess?.(data, vars);
    },
    onSettled: () => {
      if (!opts.skipInvalidate) {
        void queryClient.invalidateQueries({ queryKey: WORKSPACE_KEY });
      }
    },
  });
}

/** Immutable helper: replace one ticket in a workspace snapshot. */
export function withTicket(
  ws: Workspace,
  id: string,
  update: (t: Workspace["tickets"][number]) => Workspace["tickets"][number],
): Workspace {
  return {
    ...ws,
    tickets: ws.tickets.map((t) => (t.id === id ? update(structuredClone(t)) : t)),
  };
}
