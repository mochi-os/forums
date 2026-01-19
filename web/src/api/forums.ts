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
