import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { handleServerError, requestHelpers } from '@mochi/common'
import { forumsApi } from '@/api/forums'
import endpoints from '@/api/endpoints'
import type { Forum, DirectoryEntry, Post } from '@/api/types/forums'

// Query keys for consistency
export const forumsKeys = {
  all: ['forums'] as const,
  list: () => [...forumsKeys.all, 'list'] as const,
  detail: (forumId: string) => [...forumsKeys.all, 'detail', forumId] as const,
  search: (term: string) => [...forumsKeys.all, 'search', term] as const,
  access: (forumId: string) => [...forumsKeys.all, 'access', forumId] as const,
  post: (forumId: string, postId: string) => [...forumsKeys.all, 'post', forumId, postId] as const,
}

// ============================================================================
// Queries
// ============================================================================

export function useForumsList() {
  return useQuery({
    queryKey: forumsKeys.list(),
    queryFn: () => forumsApi.list(),
    refetchOnWindowFocus: false,
  })
}

export function useForumDetail(forumId: string | null) {
  return useQuery({
    queryKey: forumsKeys.detail(forumId!),
    queryFn: () => forumsApi.view({ forum: forumId! }),
    enabled: !!forumId,
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
}

export function useForumSearch(searchTerm: string) {
  return useQuery({
    queryKey: forumsKeys.search(searchTerm),
    queryFn: () => forumsApi.search({ search: searchTerm }),
    enabled: searchTerm.trim().length > 0,
    refetchOnWindowFocus: false,
  })
}

export function useForumAccess(forumId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: forumsKeys.access(forumId),
    queryFn: () => forumsApi.getAccess({ forum: forumId }),
    staleTime: 0,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  })
}

// ============================================================================
// Mutations
// ============================================================================

export function useCreateForum() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: forumsApi.create,
    onSuccess: () => {
      toast.success('Forum created successfully!')
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
      toast.success('Post created successfully!')
      queryClient.invalidateQueries({ queryKey: forumsKeys.list() })
      if (forumId) {
        queryClient.invalidateQueries({ queryKey: forumsKeys.detail(forumId) })
      }
    },
    onError: handleServerError,
  })
}

export function useSubscribeForum(onSubscribed?: (forumId: string) => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (forumId: string) => forumsApi.subscribe(forumId),
    onSuccess: (data, forumId) => {
      if (data.data.already_subscribed) {
        toast.info('You are already subscribed to this forum')
      } else {
        toast.success('Subscribed successfully!')
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
    mutationFn: (forumId: string) => forumsApi.unsubscribe(forumId),
    onSuccess: () => {
      toast.success('Unsubscribed successfully')
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

export function usePostDetail(forumId: string, postId: string) {
  return useQuery({
    queryKey: forumsKeys.post(forumId, postId),
    queryFn: () => forumsApi.viewPost({ forum: forumId, post: postId }),
    enabled: !!forumId && !!postId,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
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
    mutationFn: ({ commentId, vote }: { commentId: string; vote: 'up' | 'down' | '' }) =>
      forumsApi.voteComment({ forum: forumId, post: postId, comment: commentId, vote }),
    onError: handleServerError,
  })
}

export function useCreateComment(forumId: string, postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ body, parent }: { body: string; parent?: string }) =>
      forumsApi.createComment({ forum: forumId, post: postId, body, parent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      toast.success('Comment posted')
    },
    onError: handleServerError,
  })
}

export function useEditPost(forumId: string, postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; body: string; order?: string[]; attachments?: File[] }) =>
      forumsApi.editPost({
        forum: forumId,
        post: postId,
        title: data.title,
        body: data.body,
        order: data.order,
        attachments: data.attachments,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      queryClient.invalidateQueries({ queryKey: forumsKeys.detail(forumId) })
      queryClient.invalidateQueries({ queryKey: forumsKeys.list() })
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
      forumsApi.editComment({ forum: forumId, post: postId, comment: commentId, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      toast.success('Comment updated')
    },
    onError: handleServerError,
  })
}

export function useDeleteComment(forumId: string, postId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) =>
      forumsApi.deleteComment({ forum: forumId, post: postId, comment: commentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.post(forumId, postId) })
      toast.success('Comment deleted')
    },
    onError: handleServerError,
  })
}

// ============================================================================
// Selector helpers
// ============================================================================

export function selectForums(data: Awaited<ReturnType<typeof forumsApi.list>> | undefined): Forum[] {
  return data?.data?.forums || []
}

export function selectPosts(data: Awaited<ReturnType<typeof forumsApi.list>> | undefined): Post[] {
  return (data?.data?.posts || []).filter((p): p is Post => 'title' in p && !!p.title)
}

export function selectSearchResults(data: Awaited<ReturnType<typeof forumsApi.search>> | undefined): DirectoryEntry[] {
  return data?.data?.results || []
}

// ============================================================================
// User/Group queries (cross-app, via people app)
// ============================================================================

interface UserSearchResponse {
  results: Array<{ id: string; name: string }>
}

interface GroupListResponse {
  groups: Array<{ id: string; name: string; description?: string }>
}

export function useUserSearch(query: string) {
  return useQuery({
    queryKey: ['users', 'search', query],
    queryFn: async () => {
      const formData = new URLSearchParams()
      formData.append('search', query)
      return requestHelpers.post<UserSearchResponse>(
        endpoints.users.search,
        formData.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      )
    },
    enabled: query.length >= 1,
    staleTime: 30000,
  })
}

export function useGroups() {
  return useQuery({
    queryKey: ['groups', 'list'],
    queryFn: () => requestHelpers.get<GroupListResponse>(endpoints.groups.list),
    staleTime: 60000,
  })
}
