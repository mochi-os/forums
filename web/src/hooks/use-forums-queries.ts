import { useMutation, useQueryClient } from '@tanstack/react-query'
import { handleServerError, toast, useQueryWithError } from '@mochi/common'
import { forumsApi } from '@/api/forums'
import type { Forum, DirectoryEntry, Post } from '@/api/types/forums'

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
  return useQueryWithError({
    queryKey: [...forumsKeys.list(), sort],
    queryFn: () => forumsApi.listForums(sort),
    refetchOnWindowFocus: false,
  })
}

export function useForumInfo(forumId: string | null) {
  return useQueryWithError({
    queryKey: forumsKeys.info(forumId!),
    queryFn: () => forumsApi.getForumInfo(forumId!),
    enabled: !!forumId,
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
}

export function useForumsInfo() {
  return useQueryWithError({
    queryKey: [...forumsKeys.all, 'info-list'],
    queryFn: () => forumsApi.getForumsInfo(),
    refetchOnWindowFocus: false,
  })
}

export function useForumDetail(forumId: string | null, sort?: string) {
  return useQueryWithError({
    queryKey: [...forumsKeys.detail(forumId!), sort],
    queryFn: () => forumsApi.viewForum({ forum: forumId!, sort }),
    enabled: !!forumId,
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
}

export function useForumSearch(searchTerm: string) {
  return useQueryWithError({
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
  return useQueryWithError({
    queryKey: forumsKeys.access(forumId),
    queryFn: () => forumsApi.getAccess({ forum: forumId }),
    staleTime: 0,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  })
}

export function useForumRecommendations() {
  return useQueryWithError({
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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: forumsApi.createForum,
    onSuccess: () => {
      toast.success('Forum created')
      queryClient.invalidateQueries({ queryKey: forumsKeys.list() })
    },
    onError: handleServerError,
  })
}

export function useCreatePost(forumId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: forumsApi.createPost,
    onSuccess: () => {
      toast.success('Post published.')
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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ forumId, server }: { forumId: string; server?: string }) =>
      forumsApi.subscribeForum(forumId, server),
    onSuccess: (data, { forumId }) => {
      if (data.data.already_subscribed) {
        toast.info('You are already subscribed to this forum')
      } else {
        toast.success('Subscribed to forum')
        queryClient.invalidateQueries({ queryKey: forumsKeys.list() })
        onSubscribed?.(forumId)
      }
    },
    onError: handleServerError,
  })
}

export function useUnsubscribeForum(onUnsubscribed?: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (forumId: string) => forumsApi.unsubscribeForum(forumId),
    onSuccess: () => {
      toast.success('Unsubscribed')
      queryClient.invalidateQueries({ queryKey: forumsKeys.list() })
      onUnsubscribed?.()
    },
    onError: handleServerError,
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

// ============================================================================
// Thread/Post Queries
// ============================================================================

export function usePostDetail(
  forumId: string,
  postId: string,
  server?: string
) {
  return useQueryWithError({
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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ body, parent }: { body: string; parent?: string }) =>
      forumsApi.createComment({ forum: forumId, post: postId, body, parent }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: forumsKeys.post(forumId, postId),
      })
      toast.success('Comment posted')
    },
    onError: handleServerError,
  })
}

export function useEditPost(forumId: string, postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      title: string
      body: string
      order?: string[]
      attachments?: File[]
    }) =>
      forumsApi.editPost({
        forum: forumId,
        post: postId,
        title: data.title,
        body: data.body,
        order: data.order,
        attachments: data.attachments,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: forumsKeys.post(forumId, postId),
      })
      queryClient.invalidateQueries({ queryKey: forumsKeys.detail(forumId) })
      queryClient.invalidateQueries({ queryKey: forumsKeys.list() })
      queryClient.invalidateQueries({ queryKey: ['forum-posts', forumId] })
      toast.success('Post updated')
    },
    onError: handleServerError,
  })
}

export function useDeletePost(forumId: string, onDeleted?: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (postId: string) =>
      forumsApi.deletePost({ forum: forumId, post: postId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.detail(forumId) })
      queryClient.invalidateQueries({ queryKey: forumsKeys.list() })
      queryClient.invalidateQueries({ queryKey: ['forum-posts', forumId] })
      toast.success('Post deleted')
      onDeleted?.()
    },
    onError: handleServerError,
  })
}

export function useEditComment(forumId: string, postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      forumsApi.editComment({
        forum: forumId,
        post: postId,
        comment: commentId,
        body,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: forumsKeys.post(forumId, postId),
      })
      toast.success('Comment updated')
    },
    onError: handleServerError,
  })
}

export function useDeleteComment(forumId: string, postId: string) {
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
      toast.success('Comment deleted')
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

export function selectSearchResults(
  data: Awaited<ReturnType<typeof forumsApi.searchForums>> | undefined
): DirectoryEntry[] {
  return data?.data?.results || []
}

// ============================================================================
// User/Group queries (cross-app, via people app)
// ============================================================================

export function useUserSearch(query: string) {
  return useQueryWithError({
    queryKey: ['users', 'search', query],
    queryFn: () => forumsApi.searchUsers(query),
    enabled: query.length >= 1,
    staleTime: 30000,
  })
}

export function useGroups() {
  return useQueryWithError({
    queryKey: ['groups', 'list'],
    queryFn: () => forumsApi.listGroups(),
    staleTime: 60000,
  })
}

// ============================================================================
// Post Moderation Mutations
// ============================================================================

export function useRemovePost(forumId: string, postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reason?: string) =>
      forumsApi.removePost({ forum: forumId, post: postId, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      queryClient.invalidateQueries({ queryKey: forumsKeys.detail(forumId) })
      queryClient.invalidateQueries({ queryKey: ['forum-posts', forumId] })
      toast.success('Post removed')
    },
    onError: handleServerError,
  })
}

export function useRestorePost(forumId: string, postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => forumsApi.restorePost({ forum: forumId, post: postId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      queryClient.invalidateQueries({ queryKey: forumsKeys.detail(forumId) })
      queryClient.invalidateQueries({ queryKey: ['forum-posts', forumId] })
      toast.success('Post restored')
    },
    onError: handleServerError,
  })
}

export function useLockPost(forumId: string, postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => forumsApi.lockPost({ forum: forumId, post: postId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      toast.success('Post locked')
    },
    onError: handleServerError,
  })
}

export function useUnlockPost(forumId: string, postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => forumsApi.unlockPost({ forum: forumId, post: postId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      toast.success('Post unlocked')
    },
    onError: handleServerError,
  })
}

export function usePinPost(forumId: string, postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => forumsApi.pinPost({ forum: forumId, post: postId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      queryClient.invalidateQueries({ queryKey: forumsKeys.detail(forumId) })
      queryClient.invalidateQueries({ queryKey: ['forum-posts', forumId] })
      toast.success('Post pinned')
    },
    onError: handleServerError,
  })
}

export function useUnpinPost(forumId: string, postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => forumsApi.unpinPost({ forum: forumId, post: postId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      queryClient.invalidateQueries({ queryKey: forumsKeys.detail(forumId) })
      queryClient.invalidateQueries({ queryKey: ['forum-posts', forumId] })
      toast.success('Post unpinned')
    },
    onError: handleServerError,
  })
}

export function useReportPost(forumId: string, postId: string) {
  return useMutation({
    mutationFn: ({ reason, details }: { reason: string; details?: string }) =>
      forumsApi.reportPost({ forum: forumId, post: postId, reason, details }),
    onSuccess: () => {
      toast.success('Report submitted')
    },
    onError: handleServerError,
  })
}

// ============================================================================
// Comment Moderation Mutations
// ============================================================================

export function useRemoveComment(forumId: string, postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ commentId, reason }: { commentId: string; reason?: string }) =>
      forumsApi.removeComment({ forum: forumId, post: postId, comment: commentId, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      toast.success('Comment removed')
    },
    onError: handleServerError,
  })
}

export function useRestoreComment(forumId: string, postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) =>
      forumsApi.restoreComment({ forum: forumId, post: postId, comment: commentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      toast.success('Comment restored')
    },
    onError: handleServerError,
  })
}

export function useApproveComment(forumId: string, postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) =>
      forumsApi.approveComment({ forum: forumId, post: postId, comment: commentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      toast.success('Comment approved')
    },
    onError: handleServerError,
  })
}

export function useReportComment(forumId: string, postId: string) {
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
      toast.success('Report submitted')
    },
    onError: handleServerError,
  })
}
