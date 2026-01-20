import { requestHelpers } from '@mochi/common'
import endpoints from '@/api/endpoints'
import type {
  CreateCommentRequest,
  CreateCommentResponse,
  DeleteCommentRequest,
  DeleteCommentResponse,
  EditCommentRequest,
  EditCommentResponse,
  GetNewCommentParams,
  GetNewCommentResponse,
  VoteCommentRequest,
  VoteCommentResponse,
} from '@/api/types/comments'
import type {
  CreateForumRequest,
  CreateForumResponse,
  FindForumsResponse,
  GetNewForumResponse,
  ListForumsResponse,
  SearchForumsParams,
  SearchForumsResponse,
  SubscribeForumResponse,
  UnsubscribeForumResponse,
  ViewForumParams,
  ViewForumResponse,
  GetMembersParams,
  GetMembersResponse,
  SaveMembersRequest,
  SaveMembersResponse,
  GetAccessParams,
  GetAccessResponse,
  SetAccessRequest,
  SetAccessResponse,
  RevokeAccessRequest,
  RevokeAccessResponse,
  ProbeForumRequest,
  ProbeForumResponse,
} from '@/api/types/forums'
import type {
  CreatePostRequest,
  CreatePostResponse,
  DeletePostRequest,
  DeletePostResponse,
  EditPostRequest,
  EditPostResponse,
  GetNewPostParams,
  GetNewPostResponse,
  ViewPostParams,
  ViewPostResponse,
  VotePostRequest,
  VotePostResponse,
} from '@/api/types/posts'
import type {
  GetModerationSettingsParams,
  GetModerationSettingsResponse,
  SaveModerationSettingsRequest,
  SaveModerationSettingsResponse,
  GetModerationQueueParams,
  GetModerationQueueResponse,
  GetModerationLogParams,
  GetModerationLogResponse,
  GetReportsParams,
  GetReportsResponse,
  ResolveReportRequest,
  ResolveReportResponse,
  GetRestrictionsParams,
  GetRestrictionsResponse,
  RestrictUserRequest,
  RestrictUserResponse,
  UnrestrictUserRequest,
  UnrestrictUserResponse,
  RemovePostRequest,
  RemovePostResponse,
  RestorePostRequest,
  RestorePostResponse,
  ApprovePostRequest,
  ApprovePostResponse,
  LockPostRequest,
  LockPostResponse,
  UnlockPostRequest,
  UnlockPostResponse,
  PinPostRequest,
  PinPostResponse,
  UnpinPostRequest,
  UnpinPostResponse,
  ReportPostRequest,
  ReportPostResponse,
  RemoveCommentRequest,
  RemoveCommentResponse,
  RestoreCommentRequest,
  RestoreCommentResponse,
  ApproveCommentRequest,
  ApproveCommentResponse,
  ReportCommentRequest,
  ReportCommentResponse,
} from '@/api/types/moderation'

type DataEnvelope<T> = { data: T }
type MaybeWrapped<T> = T | DataEnvelope<T>

const devConsole = globalThis.console

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object'

const hasDataProperty = <T>(value: unknown): value is DataEnvelope<T> =>
  isRecord(value) && 'data' in value

const logUnexpectedStructure = (context: string, payload: unknown) => {
  if (import.meta.env.DEV) {
    devConsole?.warn?.(`[API] ${context} response shape unexpected`, payload)
  }
}

const toDataResponse = <T>(
  payload: MaybeWrapped<T>,
  context: string
): DataEnvelope<T> => {
  if (hasDataProperty<T>(payload)) {
    return { data: payload.data }
  }

  logUnexpectedStructure(context, payload)
  return { data: payload as T }
}

const omitUndefined = (
  params?: Record<string, string | undefined>
): Record<string, string> | undefined => {
  if (!params) {
    return undefined
  }

  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined
  ) as Array<[string, string]>

  if (entries.length === 0) {
    return undefined
  }

  return Object.fromEntries(entries)
}

// ============================================================================
// Forum APIs
// ============================================================================

const listForums = async (): Promise<ListForumsResponse> => {
  const response = await requestHelpers.get<
    ListForumsResponse | ListForumsResponse['data']
  >(endpoints.forums.list)

  return toDataResponse<ListForumsResponse['data']>(response, 'list forums')
}

const viewForum = async (
  params: ViewForumParams
): Promise<ViewForumResponse> => {
  const response = await requestHelpers.get<
    ViewForumResponse | ViewForumResponse['data']
  >(endpoints.forums.posts(params.forum), {
    params: omitUndefined({
      limit: params.limit?.toString(),
      before: params.before?.toString(),
      server: params.server,
    }),
  })

  return toDataResponse<ViewForumResponse['data']>(response, 'view forum')
}

const createForum = async (
  payload: CreateForumRequest
): Promise<CreateForumResponse> => {
  const response = await requestHelpers.post<
    CreateForumResponse | CreateForumResponse['data'],
    CreateForumRequest
  >(endpoints.forums.create, payload)

  return toDataResponse<CreateForumResponse['data']>(response, 'create forum')
}

const findForums = async (): Promise<FindForumsResponse> => {
  const response = await requestHelpers.get<
    FindForumsResponse | FindForumsResponse['data']
  >(endpoints.forums.find)

  return toDataResponse<FindForumsResponse['data']>(response, 'find forums')
}

const searchForums = async (
  params: SearchForumsParams
): Promise<SearchForumsResponse> => {
  const response = await requestHelpers.get<
    SearchForumsResponse | SearchForumsResponse['data']
  >(endpoints.forums.search, {
    params: { search: params.search },
  })

  return toDataResponse<SearchForumsResponse['data']>(response, 'search forums')
}

const probeForum = async (
  params: ProbeForumRequest
): Promise<ProbeForumResponse> => {
  const response = await requestHelpers.post<
    ProbeForumResponse | ProbeForumResponse['data'],
    { url: string }
  >(endpoints.forums.probe, { url: params.url })

  return toDataResponse<ProbeForumResponse['data']>(response, 'probe forum')
}

const getNewForum = async (): Promise<GetNewForumResponse> => {
  const response = await requestHelpers.get<
    GetNewForumResponse | GetNewForumResponse['data']
  >(endpoints.forums.new)

  return toDataResponse<GetNewForumResponse['data']>(response, 'new forum form')
}

const subscribeForum = async (
  forumId: string
): Promise<SubscribeForumResponse> => {
  // POST /forums/{forumId}/subscribe - no body required
  const response = await requestHelpers.post<
    SubscribeForumResponse | SubscribeForumResponse['data'],
    Record<string, never>
  >(endpoints.forums.subscribe(forumId), {})

  return toDataResponse<SubscribeForumResponse['data']>(
    response,
    'subscribe to forum'
  )
}

const unsubscribeForum = async (
  forumId: string
): Promise<UnsubscribeForumResponse> => {
  // POST /forums/{forumId}/unsubscribe - no body required
  const response = await requestHelpers.post<
    UnsubscribeForumResponse | UnsubscribeForumResponse['data'],
    Record<string, never>
  >(endpoints.forums.unsubscribe(forumId), {})

  return toDataResponse<UnsubscribeForumResponse['data']>(
    response,
    'unsubscribe from forum'
  )
}

const getMembers = async (
  params: GetMembersParams
): Promise<GetMembersResponse> => {
  // GET /forums/{forumId}/members
  const response = await requestHelpers.get<
    GetMembersResponse | GetMembersResponse['data']
  >(endpoints.forums.membersEdit(params.forum))

  return toDataResponse<GetMembersResponse['data']>(response, 'get members')
}

const saveMembers = async (
  payload: SaveMembersRequest
): Promise<SaveMembersResponse> => {
  // POST /forums/{forumId}/members/save
  const { forum, ...memberRoles } = payload
  const response = await requestHelpers.post<
    SaveMembersResponse | SaveMembersResponse['data'],
    Omit<SaveMembersRequest, 'forum'>
  >(endpoints.forums.membersSave(forum), memberRoles, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  return toDataResponse<SaveMembersResponse['data']>(response, 'save members')
}

// ============================================================================
// Post APIs
// ============================================================================

const getNewPost = async (
  params: GetNewPostParams
): Promise<GetNewPostResponse> => {
  const response = await requestHelpers.get<
    GetNewPostResponse | GetNewPostResponse['data']
  >(endpoints.forums.postNew, {
    params: { forum: params.forum },
  })

  return toDataResponse<GetNewPostResponse['data']>(response, 'new post form')
}

const createPost = async (
  payload: CreatePostRequest
): Promise<CreatePostResponse> => {
  const formData = new FormData()
  formData.append('forum', payload.forum)
  formData.append('title', payload.title)
  formData.append('body', payload.body)

  if (payload.attachments && payload.attachments.length > 0) {
    for (const file of payload.attachments) {
      formData.append('attachments', file)
    }
  }

  const response = await requestHelpers.post<
    CreatePostResponse | CreatePostResponse['data'],
    FormData
  >(endpoints.forums.postCreate, formData, {
    headers: {
      'Content-Type': undefined,
    },
  })

  return toDataResponse<CreatePostResponse['data']>(response, 'create post')
}

const viewPost = async (params: ViewPostParams): Promise<ViewPostResponse> => {
  // GET /forums/{forumId}/-/{postId}
  const response = await requestHelpers.get<
    ViewPostResponse | ViewPostResponse['data']
  >(endpoints.forums.post.view(params.forum, params.post), {
    params: omitUndefined({
      server: params.server,
    }),
  })

  return toDataResponse<ViewPostResponse['data']>(response, 'view post')
}

const votePost = async (
  payload: VotePostRequest
): Promise<VotePostResponse> => {
  // POST /forums/{forumId}/-/{postId}/vote/{vote} with body { post, vote }
  const response = await requestHelpers.post<
    VotePostResponse | VotePostResponse['data'],
    { post: string; vote: 'up' | 'down' | '' }
  >(
    endpoints.forums.post.vote(
      payload.forum,
      payload.post,
      payload.vote || 'up'
    ),
    {
      post: payload.post,
      vote: payload.vote,
    }
  )

  return toDataResponse<VotePostResponse['data']>(response, 'vote post')
}

const editPost = async (
  payload: EditPostRequest
): Promise<EditPostResponse> => {
  const formData = new FormData()
  formData.append('title', payload.title)
  formData.append('body', payload.body)

  // Send order as JSON array
  if (payload.order && payload.order.length > 0) {
    formData.append('order', JSON.stringify(payload.order))
  }

  // Add new files if any
  if (payload.attachments && payload.attachments.length > 0) {
    for (const file of payload.attachments) {
      formData.append('attachments', file)
    }
  }

  const response = await requestHelpers.post<
    EditPostResponse | EditPostResponse['data'],
    FormData
  >(endpoints.forums.post.edit(payload.forum, payload.post), formData, {
    headers: {
      'Content-Type': undefined,
    },
  })

  return toDataResponse<EditPostResponse['data']>(response, 'edit post')
}

const deletePost = async (
  payload: DeletePostRequest
): Promise<DeletePostResponse> => {
  const response = await requestHelpers.post<
    DeletePostResponse | DeletePostResponse['data'],
    Record<string, never>
  >(endpoints.forums.post.delete(payload.forum, payload.post), {})

  return toDataResponse<DeletePostResponse['data']>(response, 'delete post')
}

// ============================================================================
// Comment APIs
// ============================================================================

const getNewComment = async (
  params: GetNewCommentParams
): Promise<GetNewCommentResponse> => {
  // GET /forums/{forumId}/-/{postId}/comment?parent=...
  const response = await requestHelpers.get<
    GetNewCommentResponse | GetNewCommentResponse['data']
  >(endpoints.forums.comment.new(params.forum, params.post), {
    params: omitUndefined({
      parent: params.parent,
    }),
  })

  return toDataResponse<GetNewCommentResponse['data']>(
    response,
    'new comment form'
  )
}

const createComment = async (
  payload: CreateCommentRequest
): Promise<CreateCommentResponse> => {
  // POST /forums/{forumId}/-/{postId}/create with body { body, parent? }
  const response = await requestHelpers.post<
    CreateCommentResponse | CreateCommentResponse['data'],
    { body: string; parent?: string }
  >(endpoints.forums.comment.create(payload.forum, payload.post), {
    body: payload.body,
    parent: payload.parent,
  })

  return toDataResponse<CreateCommentResponse['data']>(
    response,
    'create comment'
  )
}

const voteComment = async (
  payload: VoteCommentRequest
): Promise<VoteCommentResponse> => {
  // POST /forums/{forumId}/-/{postId}/{commentId}/vote/{vote} - no body required
  const response = await requestHelpers.post<
    VoteCommentResponse | VoteCommentResponse['data'],
    Record<string, never>
  >(
    endpoints.forums.comment.vote(
      payload.forum,
      payload.post,
      payload.comment,
      payload.vote
    ),
    {}
  )

  return toDataResponse<VoteCommentResponse['data']>(response, 'vote comment')
}

const editComment = async (
  payload: EditCommentRequest
): Promise<EditCommentResponse> => {
  const response = await requestHelpers.post<
    EditCommentResponse | EditCommentResponse['data'],
    { body: string }
  >(
    endpoints.forums.comment.edit(payload.forum, payload.post, payload.comment),
    {
      body: payload.body,
    }
  )

  return toDataResponse<EditCommentResponse['data']>(response, 'edit comment')
}

const deleteComment = async (
  payload: DeleteCommentRequest
): Promise<DeleteCommentResponse> => {
  const response = await requestHelpers.post<
    DeleteCommentResponse | DeleteCommentResponse['data'],
    Record<string, never>
  >(
    endpoints.forums.comment.delete(
      payload.forum,
      payload.post,
      payload.comment
    ),
    {}
  )

  return toDataResponse<DeleteCommentResponse['data']>(
    response,
    'delete comment'
  )
}

// ============================================================================
// Access Control APIs
// ============================================================================

const getAccess = async (
  params: GetAccessParams
): Promise<GetAccessResponse> => {
  const response = await requestHelpers.get<
    GetAccessResponse | GetAccessResponse['data']
  >(endpoints.forums.access(params.forum))

  return toDataResponse<GetAccessResponse['data']>(response, 'get access')
}

const setAccess = async (
  payload: SetAccessRequest
): Promise<SetAccessResponse> => {
  const response = await requestHelpers.post<
    SetAccessResponse | SetAccessResponse['data'],
    { target: string; level: string }
  >(endpoints.forums.accessSet(payload.forum), {
    target: payload.user,
    level: payload.level,
  })

  return toDataResponse<SetAccessResponse['data']>(response, 'set access')
}

const revokeAccess = async (
  payload: RevokeAccessRequest
): Promise<RevokeAccessResponse> => {
  const response = await requestHelpers.post<
    RevokeAccessResponse | RevokeAccessResponse['data'],
    { target: string }
  >(endpoints.forums.accessRevoke(payload.forum), {
    target: payload.user,
  })

  return toDataResponse<RevokeAccessResponse['data']>(response, 'revoke access')
}

// ============================================================================
// Forum Delete API
// ============================================================================

const deleteForum = async (
  forumId: string
): Promise<{ data: Record<string, never> }> => {
  const response = await requestHelpers.post<
    { data: Record<string, never> } | Record<string, never>,
    Record<string, never>
  >(endpoints.forums.delete(forumId), {})

  return toDataResponse<Record<string, never>>(response, 'delete forum')
}

interface RenameForumResponse {
  data: { success: boolean }
}

const renameForum = async (
  forumId: string,
  name: string
): Promise<RenameForumResponse> => {
  const response = await requestHelpers.post<
    RenameForumResponse | RenameForumResponse['data'],
    { forum: string; name: string }
  >(endpoints.forums.rename(forumId), { forum: forumId, name })

  return toDataResponse<RenameForumResponse['data']>(response, 'rename forum')
}

// ============================================================================
// User/Group Search APIs
// ============================================================================

const searchUsers = async (
  query: string
): Promise<{ data: { results: Array<{ id: string; name: string }> } }> => {
  const formData = new URLSearchParams()
  formData.append('search', query)
  const response = await requestHelpers.post<{
    results: Array<{ id: string; name: string }>
  }>(endpoints.users.search, formData.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return { data: response }
}

const listGroups = async (): Promise<{
  data: { groups: Array<{ id: string; name: string; description?: string }> }
}> => {
  const response = await requestHelpers.get<{
    groups: Array<{ id: string; name: string; description?: string }>
  }>(endpoints.groups.list)
  return { data: response }
}

// ============================================================================
// Moderation APIs
// ============================================================================

const getModerationSettings = async (
  params: GetModerationSettingsParams
): Promise<GetModerationSettingsResponse> => {
  const response = await requestHelpers.get<
    GetModerationSettingsResponse | GetModerationSettingsResponse['data']
  >(endpoints.forums.moderation.settings(params.forum))

  return toDataResponse<GetModerationSettingsResponse['data']>(
    response,
    'get moderation settings'
  )
}

const saveModerationSettings = async (
  payload: SaveModerationSettingsRequest
): Promise<SaveModerationSettingsResponse> => {
  const { forum, ...settings } = payload
  const formData = new URLSearchParams()
  Object.entries(settings).forEach(([key, value]) => {
    formData.append(key, String(value))
  })
  const response = await requestHelpers.post<
    SaveModerationSettingsResponse | SaveModerationSettingsResponse['data'],
    URLSearchParams
  >(endpoints.forums.moderation.settingsSave(forum), formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  return toDataResponse<SaveModerationSettingsResponse['data']>(
    response,
    'save moderation settings'
  )
}

const getModerationQueue = async (
  params: GetModerationQueueParams
): Promise<GetModerationQueueResponse> => {
  const response = await requestHelpers.get<
    GetModerationQueueResponse | GetModerationQueueResponse['data']
  >(endpoints.forums.moderation.queue(params.forum))

  return toDataResponse<GetModerationQueueResponse['data']>(
    response,
    'get moderation queue'
  )
}

const getModerationLog = async (
  params: GetModerationLogParams
): Promise<GetModerationLogResponse> => {
  const response = await requestHelpers.get<
    GetModerationLogResponse | GetModerationLogResponse['data']
  >(endpoints.forums.moderation.log(params.forum), {
    params: omitUndefined({
      limit: params.limit?.toString(),
      before: params.before?.toString(),
    }),
  })

  return toDataResponse<GetModerationLogResponse['data']>(
    response,
    'get moderation log'
  )
}

const getReports = async (
  params: GetReportsParams
): Promise<GetReportsResponse> => {
  const response = await requestHelpers.get<
    GetReportsResponse | GetReportsResponse['data']
  >(endpoints.forums.moderation.reports(params.forum), {
    params: omitUndefined({
      status: params.status,
    }),
  })

  return toDataResponse<GetReportsResponse['data']>(response, 'get reports')
}

const resolveReport = async (
  payload: ResolveReportRequest
): Promise<ResolveReportResponse> => {
  const response = await requestHelpers.post<
    ResolveReportResponse | ResolveReportResponse['data'],
    { action: string }
  >(endpoints.forums.moderation.resolveReport(payload.forum, payload.report), {
    action: payload.action,
  })

  return toDataResponse<ResolveReportResponse['data']>(
    response,
    'resolve report'
  )
}

const getRestrictions = async (
  params: GetRestrictionsParams
): Promise<GetRestrictionsResponse> => {
  const response = await requestHelpers.get<
    GetRestrictionsResponse | GetRestrictionsResponse['data']
  >(endpoints.forums.restrictions(params.forum))

  return toDataResponse<GetRestrictionsResponse['data']>(
    response,
    'get restrictions'
  )
}

const restrictUser = async (
  payload: RestrictUserRequest
): Promise<RestrictUserResponse> => {
  const { forum, ...data } = payload
  const response = await requestHelpers.post<
    RestrictUserResponse | RestrictUserResponse['data'],
    Omit<RestrictUserRequest, 'forum'>
  >(endpoints.forums.restrict(forum), data)

  return toDataResponse<RestrictUserResponse['data']>(response, 'restrict user')
}

const unrestrictUser = async (
  payload: UnrestrictUserRequest
): Promise<UnrestrictUserResponse> => {
  const response = await requestHelpers.post<
    UnrestrictUserResponse | UnrestrictUserResponse['data'],
    { user: string }
  >(endpoints.forums.unrestrict(payload.forum), { user: payload.user })

  return toDataResponse<UnrestrictUserResponse['data']>(
    response,
    'unrestrict user'
  )
}

// Post moderation actions
const removePost = async (
  payload: RemovePostRequest
): Promise<RemovePostResponse> => {
  const response = await requestHelpers.post<
    RemovePostResponse | RemovePostResponse['data'],
    { reason?: string }
  >(endpoints.forums.postModeration.remove(payload.forum, payload.post), {
    reason: payload.reason,
  })

  return toDataResponse<RemovePostResponse['data']>(response, 'remove post')
}

const restorePost = async (
  payload: RestorePostRequest
): Promise<RestorePostResponse> => {
  const response = await requestHelpers.post<
    RestorePostResponse | RestorePostResponse['data'],
    Record<string, never>
  >(endpoints.forums.postModeration.restore(payload.forum, payload.post), {})

  return toDataResponse<RestorePostResponse['data']>(response, 'restore post')
}

const approvePost = async (
  payload: ApprovePostRequest
): Promise<ApprovePostResponse> => {
  const response = await requestHelpers.post<
    ApprovePostResponse | ApprovePostResponse['data'],
    Record<string, never>
  >(endpoints.forums.postModeration.approve(payload.forum, payload.post), {})

  return toDataResponse<ApprovePostResponse['data']>(response, 'approve post')
}

const lockPost = async (payload: LockPostRequest): Promise<LockPostResponse> => {
  const response = await requestHelpers.post<
    LockPostResponse | LockPostResponse['data'],
    Record<string, never>
  >(endpoints.forums.postModeration.lock(payload.forum, payload.post), {})

  return toDataResponse<LockPostResponse['data']>(response, 'lock post')
}

const unlockPost = async (
  payload: UnlockPostRequest
): Promise<UnlockPostResponse> => {
  const response = await requestHelpers.post<
    UnlockPostResponse | UnlockPostResponse['data'],
    Record<string, never>
  >(endpoints.forums.postModeration.unlock(payload.forum, payload.post), {})

  return toDataResponse<UnlockPostResponse['data']>(response, 'unlock post')
}

const pinPost = async (payload: PinPostRequest): Promise<PinPostResponse> => {
  const response = await requestHelpers.post<
    PinPostResponse | PinPostResponse['data'],
    Record<string, never>
  >(endpoints.forums.postModeration.pin(payload.forum, payload.post), {})

  return toDataResponse<PinPostResponse['data']>(response, 'pin post')
}

const unpinPost = async (
  payload: UnpinPostRequest
): Promise<UnpinPostResponse> => {
  const response = await requestHelpers.post<
    UnpinPostResponse | UnpinPostResponse['data'],
    Record<string, never>
  >(endpoints.forums.postModeration.unpin(payload.forum, payload.post), {})

  return toDataResponse<UnpinPostResponse['data']>(response, 'unpin post')
}

const reportPost = async (
  payload: ReportPostRequest
): Promise<ReportPostResponse> => {
  const response = await requestHelpers.post<
    ReportPostResponse | ReportPostResponse['data'],
    { reason: string; details?: string }
  >(endpoints.forums.postModeration.report(payload.forum, payload.post), {
    reason: payload.reason,
    details: payload.details,
  })

  return toDataResponse<ReportPostResponse['data']>(response, 'report post')
}

// Comment moderation actions
const removeComment = async (
  payload: RemoveCommentRequest
): Promise<RemoveCommentResponse> => {
  const response = await requestHelpers.post<
    RemoveCommentResponse | RemoveCommentResponse['data'],
    { reason?: string }
  >(
    endpoints.forums.commentModeration.remove(
      payload.forum,
      payload.post,
      payload.comment
    ),
    { reason: payload.reason }
  )

  return toDataResponse<RemoveCommentResponse['data']>(
    response,
    'remove comment'
  )
}

const restoreComment = async (
  payload: RestoreCommentRequest
): Promise<RestoreCommentResponse> => {
  const response = await requestHelpers.post<
    RestoreCommentResponse | RestoreCommentResponse['data'],
    Record<string, never>
  >(
    endpoints.forums.commentModeration.restore(
      payload.forum,
      payload.post,
      payload.comment
    ),
    {}
  )

  return toDataResponse<RestoreCommentResponse['data']>(
    response,
    'restore comment'
  )
}

const approveComment = async (
  payload: ApproveCommentRequest
): Promise<ApproveCommentResponse> => {
  const response = await requestHelpers.post<
    ApproveCommentResponse | ApproveCommentResponse['data'],
    Record<string, never>
  >(
    endpoints.forums.commentModeration.approve(
      payload.forum,
      payload.post,
      payload.comment
    ),
    {}
  )

  return toDataResponse<ApproveCommentResponse['data']>(
    response,
    'approve comment'
  )
}

const reportComment = async (
  payload: ReportCommentRequest
): Promise<ReportCommentResponse> => {
  const response = await requestHelpers.post<
    ReportCommentResponse | ReportCommentResponse['data'],
    { reason: string; details?: string }
  >(
    endpoints.forums.commentModeration.report(
      payload.forum,
      payload.post,
      payload.comment
    ),
    { reason: payload.reason, details: payload.details }
  )

  return toDataResponse<ReportCommentResponse['data']>(
    response,
    'report comment'
  )
}

// ============================================================================
// Export API
// ============================================================================

export const forumsApi = {
  list: listForums,
  view: viewForum,
  create: createForum,
  find: findForums,
  search: searchForums,
  probe: probeForum,
  getNewForum,
  subscribe: subscribeForum,
  unsubscribe: unsubscribeForum,
  delete: deleteForum,
  rename: renameForum,
  getMembers,
  saveMembers,
  getNewPost,
  createPost,
  viewPost,
  votePost,
  editPost,
  deletePost,
  getNewComment,
  createComment,
  voteComment,
  editComment,
  deleteComment,
  getAccess,
  setAccess,
  revokeAccess,
  searchUsers,
  listGroups,
  // Moderation
  getModerationSettings,
  saveModerationSettings,
  getModerationQueue,
  getModerationLog,
  getReports,
  resolveReport,
  getRestrictions,
  restrictUser,
  unrestrictUser,
  // Post moderation
  removePost,
  restorePost,
  approvePost,
  lockPost,
  unlockPost,
  pinPost,
  unpinPost,
  reportPost,
  // Comment moderation
  removeComment,
  restoreComment,
  approveComment,
  reportComment,
}

export type {
  CreateCommentRequest,
  CreateCommentResponse,
  CreateForumRequest,
  CreateForumResponse,
  CreatePostRequest,
  CreatePostResponse,
  DeleteCommentRequest,
  DeleteCommentResponse,
  DeletePostRequest,
  DeletePostResponse,
  EditCommentRequest,
  EditCommentResponse,
  EditPostRequest,
  EditPostResponse,
  FindForumsResponse,
  GetNewCommentParams,
  GetNewCommentResponse,
  GetNewForumResponse,
  GetNewPostParams,
  GetNewPostResponse,
  ListForumsResponse,
  ProbeForumRequest,
  ProbeForumResponse,
  SearchForumsParams,
  SearchForumsResponse,
  SubscribeForumResponse,
  UnsubscribeForumResponse,
  ViewForumParams,
  ViewForumResponse,
  ViewPostParams,
  ViewPostResponse,
  VoteCommentRequest,
  VoteCommentResponse,
  VotePostRequest,
  VotePostResponse,
  GetAccessParams,
  GetAccessResponse,
  SetAccessRequest,
  SetAccessResponse,
  RevokeAccessRequest,
  RevokeAccessResponse,
}

export default forumsApi
