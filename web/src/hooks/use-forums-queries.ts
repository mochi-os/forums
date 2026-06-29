// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLingui } from '@lingui/react/macro'
import { handleServerError, toast, toastAction, getErrorMessage, MUTATION_SKIPPED, isMutationSkipped, textUnchanged, type MutationFnResult } from '@mochi/web'
import forumsApi from '@/api/forums'
import type { Forum, DirectoryEntry, Post } from '@/api/types/forums'
import type { EditPostResponse } from '@/api/types/posts'
import type { EditCommentResponse } from '@/api/types/comments'
import { isForumPostEditUnchanged, type ForumPostEditOriginal } from '@/features/forums/edit-compare'

// Query keys for consistency
export const forumsKeys = {
  all: ['forums'] as const,
  list: () => [...forumsKeys.all, 'list'] as const,
  info: (forumId: string) => [...forumsKeys.all, 'info', forumId] as const,
  detail: (forumId: string) => [...forumsKeys.all, 'detail', forumId] as const,
  search: (term: string) => [...forumsKeys.all, 'search', term] as const,
  access: (forumId: string) => [...forumsKeys.all, 'access', forumId] as const,
  recommendations: () => [...forumsKeys.all, 'recommendations'] as const,
  post: (forumId: string, postId: string) =>
    [...forumsKeys.all, 'post', forumId, postId] as const,
}

// ============================================================================
// Queries
// ============================================================================

export function useForumsList(sort?: string) {
  return useQuery({
    queryKey: [...forumsKeys.list(), sort],
    queryFn: () => forumsApi.listForums(sort),
    refetchOnWindowFocus: false,
  })
}

export function useForumInfo(forumId: string | null) {
  return useQuery({
    queryKey: forumsKeys.info(forumId!),
    queryFn: () => forumsApi.getForumInfo(forumId!),
    enabled: !!forumId,
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
}

export function useForumsInfo() {
  return useQuery({
    queryKey: [...forumsKeys.all, 'info-list'],
    queryFn: () => forumsApi.getForumsInfo(),
    refetchOnWindowFocus: false,
  })
}

export function useForumDetail(forumId: string | null, sort?: string) {
  return useQuery({
    queryKey: [...forumsKeys.detail(forumId!), sort],
    queryFn: () => forumsApi.viewForum({ forum: forumId!, sort }),
    enabled: !!forumId,
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
}

export function useForumSearch(searchTerm: string) {
  return useQuery({
    queryKey: forumsKeys.search(searchTerm),
    queryFn: () => forumsApi.searchForums({ search: searchTerm }),
    enabled: searchTerm.trim().length > 0,
    refetchOnWindowFocus: false,
  })
}

export function useForumAccess(
  forumId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: forumsKeys.access(forumId),
    queryFn: () => forumsApi.getAccess({ forum: forumId }),
    staleTime: 0,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  })
}

export function useForumRecommendations() {
  return useQuery({
    queryKey: forumsKeys.recommendations(),
    queryFn: () => forumsApi.getRecommendations(),
    retry: false,
    refetchOnWindowFocus: false,
  })
}

// ============================================================================
// Mutations
// ============================================================================

export function useCreateForum() {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: Parameters<typeof forumsApi.createForum>[0]) =>
      toastAction(forumsApi.createForum(payload), {
        loading: t`Creating forum...`,
        success: t`Forum created`,
        error: (e) => getErrorMessage(e, t`Failed to create forum`),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.all })
    },
  })
}

export function useDeleteForum(onDeleted?: () => void) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (forumId: string) =>
      toastAction(forumsApi.deleteForum(forumId), {
        loading: t`Deleting forum...`,
        success: t`Forum deleted`,
        error: (e) => getErrorMessage(e, t`Failed to delete forum`),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.all })
      onDeleted?.()
    },
  })
}

export function useCreatePost(forumId: string | null) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: forumsApi.createPost,
    onSuccess: () => {
      toast.success(t`Post published.`)
      queryClient.invalidateQueries({ queryKey: forumsKeys.list() })
      if (forumId) {
        queryClient.invalidateQueries({ queryKey: forumsKeys.detail(forumId) })
        queryClient.invalidateQueries({ queryKey: ['forum-posts', forumId] })
      }
    },
    onError: handleServerError,
  })
}

export function useSubscribeForum(onSubscribed?: (forumId: string) => void) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ forumId, server }: { forumId: string; server?: string }) =>
      toastAction(forumsApi.subscribeForum(forumId, server), {
        loading: t`Subscribing...`,
        success: false,
        error: (e) => getErrorMessage(e, t`Failed to subscribe`),
      }),
    onSuccess: (data, { forumId }) => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.all })
      if (data.data?.already_subscribed) {
        toast.info(t`You are already subscribed to this forum`)
      } else {
        toast.success(t`Subscribed to forum`)
        onSubscribed?.(forumId)
      }
    },
  })
}

export function useUnsubscribeForum(onUnsubscribed?: () => void) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (forumId: string) =>
      toastAction(forumsApi.unsubscribeForum(forumId), {
        loading: t`Unsubscribing...`,
        success: t`Unsubscribed`,
        error: (e) => getErrorMessage(e, t`Failed to unsubscribe`),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.all })
      onUnsubscribed?.()
    },
  })
}

export function useSetAccess(forumId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: forumsApi.setAccess,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.access(forumId) })
    },
    onError: handleServerError,
  })
}

export function useRevokeAccess(forumId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: forumsApi.revokeAccess,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.access(forumId) })
    },
    onError: handleServerError,
  })
}

export function useSetDefaultSort() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sort: string) => forumsApi.setDefaultSort(sort),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.list() })
      queryClient.invalidateQueries({ queryKey: [...forumsKeys.all, 'info-list'] })
    },
    onError: handleServerError,
  })
}

export function useSetForumSort(forumId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sort: string) => forumsApi.setForumSort(forumId, sort),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.info(forumId) })
      queryClient.invalidateQueries({ queryKey: forumsKeys.detail(forumId) })
      queryClient.invalidateQueries({ queryKey: [...forumsKeys.all, 'info-list'] })
    },
    onError: handleServerError,
  })
}

// ============================================================================
// Thread/Post Queries
// ============================================================================

export function usePostDetail(
  forumId: string,
  postId: string,
  server?: string
) {
  return useQuery({
    queryKey: [...forumsKeys.post(forumId, postId), server],
    queryFn: () => forumsApi.viewPost({ forum: forumId, post: postId, server }),
    enabled: !!forumId && !!postId,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

export function useVotePost(forumId: string, postId: string) {
  return useMutation({
    mutationFn: (vote: 'up' | 'down' | '') =>
      forumsApi.votePost({ forum: forumId, post: postId, vote }),
    onError: handleServerError,
  })
}

export function useVoteComment(forumId: string, postId: string) {
  return useMutation({
    mutationFn: ({
      commentId,
      vote,
    }: {
      commentId: string
      vote: 'up' | 'down' | ''
    }) =>
      forumsApi.voteComment({
        forum: forumId,
        post: postId,
        comment: commentId,
        vote,
      }),
    onError: handleServerError,
  })
}

export function useCreateComment(forumId: string, postId: string) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ body, parent, files }: { body: string; parent?: string; files?: File[] }) =>
      forumsApi.createComment({ forum: forumId, post: postId, body, parent, files }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: forumsKeys.post(forumId, postId),
      })
      toast.success(t`Comment posted`)
    },
    onError: handleServerError,
  })
}

export function useEditPost(forumId: string, postId: string) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  return useMutation<
    MutationFnResult<EditPostResponse>,
    Error,
    {
      title: string
      body: string
      order?: string[]
      attachments?: File[]
      original: ForumPostEditOriginal
    }
  >({
    mutationFn: async (data) => {
      if (
        isForumPostEditUnchanged(data.original, {
          title: data.title,
          body: data.body,
          order: data.order,
          attachments: data.attachments,
        })
      ) {
        return MUTATION_SKIPPED
      }
      return forumsApi.editPost({
        forum: forumId,
        post: postId,
        title: data.title,
        body: data.body,
        order: data.order,
        attachments: data.attachments,
      })
    },
    onSuccess: (result) => {
      if (isMutationSkipped(result)) return
      queryClient.invalidateQueries({
        queryKey: forumsKeys.post(forumId, postId),
      })
      queryClient.invalidateQueries({ queryKey: forumsKeys.detail(forumId) })
      queryClient.invalidateQueries({ queryKey: forumsKeys.list() })
      queryClient.invalidateQueries({ queryKey: ['forum-posts', forumId] })
      toast.success(t`Post updated`)
    },
    onError: handleServerError,
  })
}

export function useDeletePost(forumId: string, onDeleted?: () => void) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (postId: string) =>
      forumsApi.deletePost({ forum: forumId, post: postId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.detail(forumId) })
      queryClient.invalidateQueries({ queryKey: forumsKeys.list() })
      queryClient.invalidateQueries({ queryKey: ['forum-posts', forumId] })
      toast.success(t`Post deleted`)
      onDeleted?.()
    },
    onError: handleServerError,
  })
}

export function useEditComment(forumId: string, postId: string) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  return useMutation<
    MutationFnResult<EditCommentResponse>,
    Error,
    {
      commentId: string
      body: string
      originalBody: string
    }
  >({
    mutationFn: async ({
      commentId,
      body,
      originalBody,
    }) => {
      if (textUnchanged(body, originalBody)) {
        return MUTATION_SKIPPED
      }
      return forumsApi.editComment({
        forum: forumId,
        post: postId,
        comment: commentId,
        body,
      })
    },
    onSuccess: (result) => {
      if (isMutationSkipped(result)) return
      queryClient.invalidateQueries({
        queryKey: forumsKeys.post(forumId, postId),
      })
      toast.success(t`Comment updated`)
    },
    onError: handleServerError,
  })
}

export function useDeleteComment(forumId: string, postId: string) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) =>
      forumsApi.deleteComment({
        forum: forumId,
        post: postId,
        comment: commentId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: forumsKeys.post(forumId, postId),
      })
      toast.success(t`Comment deleted`)
    },
    onError: handleServerError,
  })
}

// ============================================================================
// Selector helpers
// ============================================================================

export function selectForums(
  data: Awaited<ReturnType<typeof forumsApi.listForums>> | undefined
): Forum[] {
  return data?.data?.forums || []
}

export function selectPosts(
  data: Awaited<ReturnType<typeof forumsApi.listForums>> | undefined
): Post[] {
  return (data?.data?.posts || []).filter(
    (p): p is Post => 'title' in p && !!p.title
  )
}

export function selectDefaultSort(
  data: Awaited<ReturnType<typeof forumsApi.listForums>> | undefined
): string {
  return data?.data?.settings?.sort ?? ''
}

export function selectSearchResults(
  data: Awaited<ReturnType<typeof forumsApi.searchForums>> | undefined
): DirectoryEntry[] {
  return data?.data?.results || []
}

// ============================================================================
// User/Group queries (cross-app, via people app)
// ============================================================================

export function useUserSearch(query: string) {
  return useQuery({
    queryKey: ['users', 'search', query],
    queryFn: () => forumsApi.searchUsers(query),
    enabled: query.length >= 1,
    staleTime: 30000,
  })
}

export function useGroups() {
  return useQuery({
    queryKey: ['groups', 'list'],
    queryFn: () => forumsApi.listGroups(),
    staleTime: 60000,
  })
}

// ============================================================================
// Post Moderation Mutations
// ============================================================================

export function useRemovePost(forumId: string, postId: string) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reason?: string) =>
      forumsApi.removePost({ forum: forumId, post: postId, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      queryClient.invalidateQueries({ queryKey: forumsKeys.detail(forumId) })
      queryClient.invalidateQueries({ queryKey: ['forum-posts', forumId] })
      toast.success(t`Post removed`)
    },
    onError: handleServerError,
  })
}

export function useRestorePost(forumId: string, postId: string) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => forumsApi.restorePost({ forum: forumId, post: postId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      queryClient.invalidateQueries({ queryKey: forumsKeys.detail(forumId) })
      queryClient.invalidateQueries({ queryKey: ['forum-posts', forumId] })
      toast.success(t`Post restored`)
    },
    onError: handleServerError,
  })
}

export function useLockPost(forumId: string, postId: string) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => forumsApi.lockPost({ forum: forumId, post: postId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      toast.success(t`Post locked`)
    },
    onError: handleServerError,
  })
}

export function useUnlockPost(forumId: string, postId: string) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => forumsApi.unlockPost({ forum: forumId, post: postId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      toast.success(t`Post unlocked`)
    },
    onError: handleServerError,
  })
}

export function usePinPost(forumId: string, postId: string) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => forumsApi.pinPost({ forum: forumId, post: postId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      queryClient.invalidateQueries({ queryKey: forumsKeys.detail(forumId) })
      queryClient.invalidateQueries({ queryKey: ['forum-posts', forumId] })
      toast.success(t`Post pinned`)
    },
    onError: handleServerError,
  })
}

export function useUnpinPost(forumId: string, postId: string) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => forumsApi.unpinPost({ forum: forumId, post: postId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      queryClient.invalidateQueries({ queryKey: forumsKeys.detail(forumId) })
      queryClient.invalidateQueries({ queryKey: ['forum-posts', forumId] })
      toast.success(t`Post unpinned`)
    },
    onError: handleServerError,
  })
}

export function useReportPost(forumId: string, postId: string) {
  const { t } = useLingui()
  return useMutation({
    mutationFn: ({ reason, details }: { reason: string; details?: string }) =>
      forumsApi.reportPost({ forum: forumId, post: postId, reason, details }),
    onSuccess: () => {
      toast.success(t`Report submitted`)
    },
    onError: handleServerError,
  })
}

// ============================================================================
// Comment Moderation Mutations
// ============================================================================

export function useRemoveComment(forumId: string, postId: string) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ commentId, reason }: { commentId: string; reason?: string }) =>
      forumsApi.removeComment({ forum: forumId, post: postId, comment: commentId, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      toast.success(t`Comment removed`)
    },
    onError: handleServerError,
  })
}

export function useRestoreComment(forumId: string, postId: string) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) =>
      forumsApi.restoreComment({ forum: forumId, post: postId, comment: commentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      toast.success(t`Comment restored`)
    },
    onError: handleServerError,
  })
}

export function useApproveComment(forumId: string, postId: string) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) =>
      forumsApi.approveComment({ forum: forumId, post: postId, comment: commentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      toast.success(t`Comment approved`)
    },
    onError: handleServerError,
  })
}

export function useReportComment(forumId: string, postId: string) {
  const { t } = useLingui()
  return useMutation({
    mutationFn: ({
      commentId,
      reason,
      details,
    }: {
      commentId: string
      reason: string
      details?: string
    }) =>
      forumsApi.reportComment({
        forum: forumId,
        post: postId,
        comment: commentId,
        reason,
        details,
      }),
    onSuccess: () => {
      toast.success(t`Report submitted`)
    },
    onError: handleServerError,
  })
}
