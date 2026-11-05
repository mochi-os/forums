// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useLingui } from '@lingui/react/macro'
import {
  handleServerError,
  optimistic,
  optimisticFields,
  type FieldsPlace,
  toast,
  toastAction,
  getErrorMessage,
  MUTATION_SKIPPED,
  isMutationSkipped,
  textUnchanged,
  useUploadProgress,
  type MutationFnResult,
} from '@mochi/web'
import forumsApi from '@/api/forums'
import type { EditCommentResponse } from '@/api/types/comments'
import type {
  Forum,
  NotificationKind,
  NotificationSettingsResponse,
  Post,
} from '@/api/types/forums'
import type {
  EditPostResponse,
  ViewPostComment,
  ViewPostResponse,
} from '@/api/types/posts'
import {
  isForumPostEditUnchanged,
  type ForumPostEditOriginal,
} from '@/features/forums/edit-compare'

// Query keys for consistency
export const forumsKeys = {
  all: ['forums'] as const,
  list: () => [...forumsKeys.all, 'list'] as const,
  info: (forumId: string) => [...forumsKeys.all, 'info', forumId] as const,
  detail: (forumId: string) => [...forumsKeys.all, 'detail', forumId] as const,
  search: (term: string) => [...forumsKeys.all, 'search', term] as const,
  access: (forumId: string) => [...forumsKeys.all, 'access', forumId] as const,
  members: (forumId: string) =>
    [...forumsKeys.all, 'members', forumId] as const,
  recommendations: () => [...forumsKeys.all, 'recommendations'] as const,
  post: (forumId: string, postId: string) =>
    [...forumsKeys.all, 'post', forumId, postId] as const,
  notifications: (forumId: string) =>
    [...forumsKeys.all, 'notifications', forumId] as const,
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

// Shared options for the class-level `-/information` query, so the landing
// route loader (via ensureQueryData) and the layout's useForumsInfo hit ONE
// cache entry instead of both fetching `-/information` on the same load. The
// small staleTime keeps the loader-populated cache fresh across the immediate
// layout mount; mutations still invalidate it explicitly.
export function forumsInfoQueryOptions() {
  return {
    queryKey: [...forumsKeys.all, 'info-list'] as const,
    queryFn: () => forumsApi.getForumsInfo(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  }
}

export function useForumsInfo() {
  return useQuery(forumsInfoQueryOptions())
}

// Whether this user holds the forum, and the default sort, from the
// information query the layout already holds. Not the list query: that one
// renders up to a hundred posts across every subscribed forum to answer the
// same question.
export function useForumMembership(forumId: string) {
  const { data, isLoading } = useForumsInfo()
  const forums = data?.data?.forums ?? []
  return {
    isSubscribed: forums.some((f) => f.id === forumId),
    defaultSort: data?.data?.settings?.sort ?? '',
    isLoading,
  }
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

export function useForumMembers(forumId: string) {
  return useQuery({
    queryKey: forumsKeys.members(forumId),
    queryFn: () => forumsApi.listMembers(forumId),
    staleTime: 0,
    refetchOnWindowFocus: false,
  })
}

// Removal drops the member's row, votes, replay record and access in one call.
// The forum's member count lives on the info queries, so those refresh too.
export function useRemoveForumMember(forumId: string) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (member: string) => forumsApi.removeMember(forumId, member),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: forumsKeys.members(forumId),
      })
      void queryClient.invalidateQueries({ queryKey: forumsKeys.info(forumId) })
      void queryClient.invalidateQueries({
        queryKey: forumsInfoQueryOptions().queryKey,
      })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t`Failed to remove member`))
    },
  })
}

// A block is the "No access" level: a deny on every level, and the server
// drops the member with it, so the same queries refresh as for a removal plus
// the access rules the deny now appears in.
export function useBlockForumMember(forumId: string) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (member: string) =>
      forumsApi.setAccess({ forum: forumId, user: member, level: 'none' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: forumsKeys.members(forumId),
      })
      void queryClient.invalidateQueries({
        queryKey: forumsKeys.access(forumId),
      })
      void queryClient.invalidateQueries({ queryKey: forumsKeys.info(forumId) })
      void queryClient.invalidateQueries({
        queryKey: forumsInfoQueryOptions().queryKey,
      })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, t`Failed to block member`))
    },
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
  const { progress, upload } = useUploadProgress()
  const mutation = useMutation({
    mutationFn: (payload: Parameters<typeof forumsApi.createPost>[0]) =>
      payload.attachments?.length
        ? upload((onProgress) => forumsApi.createPost(payload, onProgress), {
            sizes: payload.attachments.map((file) => file.size),
          })
        : forumsApi.createPost(payload),
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
  return { ...mutation, progress }
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

export function useSetDefaultSort() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sort: string) => forumsApi.setDefaultSort(sort),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: forumsKeys.list() })
      queryClient.invalidateQueries({
        queryKey: [...forumsKeys.all, 'info-list'],
      })
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
      queryClient.invalidateQueries({
        queryKey: [...forumsKeys.all, 'info-list'],
      })
    },
    onError: handleServerError,
  })
}

export function useForumNotifications(forumId: string, enabled: boolean) {
  return useQuery({
    queryKey: forumsKeys.notifications(forumId),
    queryFn: () => forumsApi.getNotifications(forumId),
    enabled,
    refetchOnWindowFocus: false,
  })
}

// The tick moves on the click and goes back if the server refuses. The
// server's answer then replaces it, along with any kind the change covers.
export function useSetForumNotification(forumId: string) {
  const queryClient = useQueryClient()
  const patch = optimistic(
    queryClient,
    ({ kind, enabled }: { kind: NotificationKind; enabled: boolean }) => [
      {
        filters: { queryKey: forumsKeys.notifications(forumId), exact: true },
        update: (old: NotificationSettingsResponse) => ({
          ...old,
          data: { ...old.data, [kind]: enabled },
        }),
      },
    ]
  )
  return useMutation({
    mutationFn: ({
      kind,
      enabled,
    }: {
      kind: NotificationKind
      enabled: boolean
    }) => forumsApi.setNotification(forumId, kind, enabled),
    onMutate: patch.onMutate,
    onSuccess: (response: NotificationSettingsResponse) => {
      queryClient.setQueryData(forumsKeys.notifications(forumId), response)
    },
    onError: (error, _variables, context) => {
      patch.rollback(context)
      handleServerError(error)
    },
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

type Vote = 'up' | 'down' | ''

// The post query is keyed by the server it came from as well, and a view the
// server could not answer is cached with no post (thread-detail.tsx shows it
// as not found). A patch leaves that copy alone rather than throwing, which
// would stop the request being sent.
function hasPost(old: ViewPostResponse | undefined): old is ViewPostResponse {
  return !!old?.data?.post
}

// Votes, lock, pin and follow all change the one post query, often several
// at once: a vote on two comments, or a vote while a lock is out. Each goes
// back field by field on its own item, so a refused one leaves the others as
// the reader set them. A whole-query undo would put back the post as it was
// before both.

// The post's own fields.
const onPost = (forumId: string, postId: string): FieldsPlace<Post>[] => [
  {
    filters: { queryKey: forumsKeys.post(forumId, postId) },
    edit: (old: ViewPostResponse, _id, change) => {
      if (!hasPost(old)) return old
      const post = change(old.data.post)
      return post === old.data.post
        ? old
        : { ...old, data: { ...old.data, post } }
    },
  },
]

function editComments(
  comments: ViewPostComment[],
  id: string,
  change: (comment: ViewPostComment) => ViewPostComment
): ViewPostComment[] {
  let changed = false
  const next = comments.map((comment) => {
    const updated = comment.id === id ? change(comment) : comment
    const children = comment.children?.length
      ? editComments(comment.children, id, change)
      : comment.children
    if (updated === comment && children === comment.children) return comment
    changed = true
    return { ...updated, children }
  })
  return changed ? next : comments
}

// A comment anywhere in the post's thread.
const onComment = (
  forumId: string,
  postId: string
): FieldsPlace<ViewPostComment>[] => [
  {
    filters: { queryKey: forumsKeys.post(forumId, postId) },
    edit: (old: ViewPostResponse, id, change) => {
      if (!hasPost(old)) return old
      const comments = editComments(old.data.comments ?? [], id, change)
      return comments === old.data.comments
        ? old
        : { ...old, data: { ...old.data, comments } }
    },
  },
]

// The counts after changing the reader's vote, the same sums the vote buttons
// make on the click. The server answers a vote with no counts, so this guess
// stays in the cache until the post is next fetched, as it stays in the
// buttons' own state on main.
function applyVote<T extends { up: number; down: number; user_vote?: Vote }>(
  item: T,
  vote: Vote
): T {
  const previous = item.user_vote || ''
  if (previous === vote) return item
  let { up, down } = item
  if (previous === 'up') up -= 1
  if (previous === 'down') down -= 1
  if (vote === 'up') up += 1
  if (vote === 'down') down += 1
  return { ...item, up, down, user_vote: vote }
}

const VOTE_FIELDS = ['up', 'down', 'user_vote'] as const

// Votes show at once in the buttons' own state, which follows the post query.
// Patching the query as well means a refused vote puts the buttons back too:
// the fields go back, and their sync effect copies them in.
export function useVotePost(forumId: string, postId: string) {
  const queryClient = useQueryClient()
  const patch = optimisticFields(queryClient, {
    places: onPost(forumId, postId),
    id: () => postId,
    fields: VOTE_FIELDS,
    apply: (post: Post, vote: Vote) => applyVote(post, vote),
  })
  return useMutation({
    mutationFn: (vote: Vote) =>
      forumsApi.votePost({ forum: forumId, post: postId, vote }),
    onMutate: patch.onMutate,
    onError: (error, _variables, context) => {
      patch.rollback(context)
      handleServerError(error)
    },
  })
}

export function useVoteComment(forumId: string, postId: string) {
  const queryClient = useQueryClient()
  const patch = optimisticFields(queryClient, {
    places: onComment(forumId, postId),
    id: ({ commentId }: { commentId: string; vote: Vote }) => commentId,
    fields: VOTE_FIELDS,
    apply: (comment: ViewPostComment, { vote }) => applyVote(comment, vote),
  })
  return useMutation({
    mutationFn: ({ commentId, vote }: { commentId: string; vote: Vote }) =>
      forumsApi.voteComment({
        forum: forumId,
        post: postId,
        comment: commentId,
        vote,
      }),
    onMutate: patch.onMutate,
    onError: (error, _variables, context) => {
      patch.rollback(context)
      handleServerError(error)
    },
  })
}

export function useCreateComment(forumId: string, postId: string) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const { progress, upload } = useUploadProgress()
  const mutation = useMutation({
    mutationFn: ({
      body,
      parent,
      files,
      attachment,
    }: {
      body: string
      parent?: string
      files?: File[]
      attachment?: string
    }) => {
      const payload = {
        forum: forumId,
        post: postId,
        body,
        parent,
        files,
        attachment,
      }
      return files?.length
        ? upload((onProgress) => forumsApi.createComment(payload, onProgress), {
            sizes: files.map((file) => file.size),
          })
        : forumsApi.createComment(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: forumsKeys.post(forumId, postId),
      })
      toast.success(t`Comment posted`)
    },
    onError: handleServerError,
  })
  return { ...mutation, progress }
}

export function useEditPost(forumId: string, postId: string) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const { progress, upload } = useUploadProgress()
  const mutation = useMutation<
    MutationFnResult<EditPostResponse>,
    Error,
    {
      title: string
      body: string
      url?: string
      sensitive?: boolean
      language?: string
      order?: string[]
      attachments?: File[]
      captions?: Record<string, string>
      original: ForumPostEditOriginal
    }
  >({
    mutationFn: async (data) => {
      if (
        isForumPostEditUnchanged(data.original, {
          title: data.title,
          body: data.body,
          url: data.url,
          sensitive: data.sensitive,
          language: data.language,
          order: data.order,
          attachments: data.attachments,
          captions: data.captions,
        })
      ) {
        return MUTATION_SKIPPED
      }
      const payload = {
        forum: forumId,
        post: postId,
        title: data.title,
        body: data.body,
        url: data.url,
        sensitive: data.sensitive,
        language: data.language,
        order: data.order,
        attachments: data.attachments,
        captions: data.captions,
      }
      return data.attachments?.length
        ? upload((onProgress) => forumsApi.editPost(payload, onProgress), {
            // Only the new files ride the body; saved ones come back via `order`.
            sizes: data.attachments.map((file) => file.size),
          })
        : forumsApi.editPost(payload)
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
  return { ...mutation, progress }
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
    mutationFn: async ({ commentId, body, originalBody }) => {
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
      queryClient.invalidateQueries({
        queryKey: forumsKeys.post(forumId, postId),
      })
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
      queryClient.invalidateQueries({
        queryKey: forumsKeys.post(forumId, postId),
      })
      queryClient.invalidateQueries({ queryKey: forumsKeys.detail(forumId) })
      queryClient.invalidateQueries({ queryKey: ['forum-posts', forumId] })
      toast.success(t`Post restored`)
    },
    onError: handleServerError,
  })
}

// Lock and pin show on the post at once and go back if the server refuses.
// Only the post is patched: where a pinned post sits in the list is the
// server's to say, so the list waits for the refetch on success.
function postFlag(
  queryClient: QueryClient,
  forumId: string,
  postId: string,
  flag: 'locked' | 'pinned',
  value: boolean
) {
  return optimisticFields<void, Post>(queryClient, {
    places: onPost(forumId, postId),
    id: () => postId,
    fields: [flag],
    apply: (post: Post) =>
      post[flag] === value ? post : { ...post, [flag]: value },
  })
}

export function useLockPost(forumId: string, postId: string) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const patch = postFlag(queryClient, forumId, postId, 'locked', true)
  return useMutation({
    mutationFn: () => forumsApi.lockPost({ forum: forumId, post: postId }),
    onMutate: patch.onMutate,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: forumsKeys.post(forumId, postId),
      })
      toast.success(t`Post locked`)
    },
    onError: (error, _variables, context) => {
      patch.rollback(context)
      handleServerError(error)
    },
  })
}

export function useUnlockPost(forumId: string, postId: string) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const patch = postFlag(queryClient, forumId, postId, 'locked', false)
  return useMutation({
    mutationFn: () => forumsApi.unlockPost({ forum: forumId, post: postId }),
    onMutate: patch.onMutate,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: forumsKeys.post(forumId, postId),
      })
      toast.success(t`Post unlocked`)
    },
    onError: (error, _variables, context) => {
      patch.rollback(context)
      handleServerError(error)
    },
  })
}

// Follow flips on the click and back if refused. The post's key ends in the
// server it was read from, so the patch matches it as a prefix.
export function useFollowPost(forumId: string, postId: string) {
  const queryClient = useQueryClient()
  const patch = optimisticFields(queryClient, {
    places: [
      {
        filters: { queryKey: forumsKeys.post(forumId, postId) },
        edit: (old: ViewPostResponse, _id, change) => {
          if (!old?.data) return old
          const data = change(old.data)
          return data === old.data ? old : { ...old, data }
        },
      },
    ],
    id: () => postId,
    fields: ['following'],
    apply: (data: ViewPostResponse['data'], following: boolean) =>
      data.following === following ? data : { ...data, following },
  })
  return useMutation({
    mutationFn: (following: boolean) =>
      forumsApi.followPost(forumId, postId, following),
    onMutate: patch.onMutate,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: forumsKeys.post(forumId, postId),
      })
    },
    onError: (error, _following, context) => {
      patch.rollback(context)
      handleServerError(error)
    },
  })
}

export function usePinPost(forumId: string, postId: string) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const patch = postFlag(queryClient, forumId, postId, 'pinned', true)
  return useMutation({
    mutationFn: () => forumsApi.pinPost({ forum: forumId, post: postId }),
    onMutate: patch.onMutate,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: forumsKeys.post(forumId, postId),
      })
      queryClient.invalidateQueries({ queryKey: forumsKeys.detail(forumId) })
      queryClient.invalidateQueries({ queryKey: ['forum-posts', forumId] })
      toast.success(t`Post pinned`)
    },
    onError: (error, _variables, context) => {
      patch.rollback(context)
      handleServerError(error)
    },
  })
}

export function useUnpinPost(forumId: string, postId: string) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const patch = postFlag(queryClient, forumId, postId, 'pinned', false)
  return useMutation({
    mutationFn: () => forumsApi.unpinPost({ forum: forumId, post: postId }),
    onMutate: patch.onMutate,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: forumsKeys.post(forumId, postId),
      })
      queryClient.invalidateQueries({ queryKey: forumsKeys.detail(forumId) })
      queryClient.invalidateQueries({ queryKey: ['forum-posts', forumId] })
      toast.success(t`Post unpinned`)
    },
    onError: (error, _variables, context) => {
      patch.rollback(context)
      handleServerError(error)
    },
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
    mutationFn: ({
      commentId,
      reason,
    }: {
      commentId: string
      reason?: string
    }) =>
      forumsApi.removeComment({
        forum: forumId,
        post: postId,
        comment: commentId,
        reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: forumsKeys.post(forumId, postId),
      })
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
      forumsApi.restoreComment({
        forum: forumId,
        post: postId,
        comment: commentId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: forumsKeys.post(forumId, postId),
      })
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
      forumsApi.approveComment({
        forum: forumId,
        post: postId,
        comment: commentId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: forumsKeys.post(forumId, postId),
      })
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
