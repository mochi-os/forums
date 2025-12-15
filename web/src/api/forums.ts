import endpoints from '@/api/endpoints'
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
  ViewForumResponse,
  GetMembersParams,
  GetMembersResponse,
  SaveMembersRequest,
  SaveMembersResponse,
} from '@/api/types/forums'
import type {
  CreatePostRequest,
  CreatePostResponse,
  GetNewPostParams,
  GetNewPostResponse,
  ViewPostParams,
  ViewPostResponse,
  VotePostRequest,
  VotePostResponse,
} from '@/api/types/posts'
import type {
  CreateCommentRequest,
  CreateCommentResponse,
  GetNewCommentParams,
  GetNewCommentResponse,
  VoteCommentRequest,
  VoteCommentResponse,
} from '@/api/types/comments'
import { requestHelpers } from '@mochi/common'

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

const viewForum = async (forumId: string): Promise<ViewForumResponse> => {
  const response = await requestHelpers.get<
    ViewForumResponse | ViewForumResponse['data']
  >(endpoints.forums.list, {
    params: { forum: forumId },
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

  return toDataResponse<SearchForumsResponse['data']>(
    response,
    'search forums'
  )
}

const getNewForum = async (): Promise<GetNewForumResponse> => {
  const response = await requestHelpers.get<
    GetNewForumResponse | GetNewForumResponse['data']
  >(endpoints.forums.new)

  return toDataResponse<GetNewForumResponse['data']>(
    response,
    'new forum form'
  )
}

const subscribeForum = async (
  forumId: string
): Promise<SubscribeForumResponse> => {
  const response = await requestHelpers.post<
    SubscribeForumResponse | SubscribeForumResponse['data'],
    { forum: string }
  >(endpoints.forums.subscribe, { forum: forumId })

  return toDataResponse<SubscribeForumResponse['data']>(
    response,
    'subscribe to forum'
  )
}

const unsubscribeForum = async (
  forumId: string
): Promise<UnsubscribeForumResponse> => {
  const response = await requestHelpers.post<
    UnsubscribeForumResponse | UnsubscribeForumResponse['data'],
    { forum: string }
  >(endpoints.forums.unsubscribe, { forum: forumId })

  return toDataResponse<UnsubscribeForumResponse['data']>(
    response,
    'unsubscribe from forum'
  )
}

const getMembers = async (
  params: GetMembersParams
): Promise<GetMembersResponse> => {
  const response = await requestHelpers.get<
    GetMembersResponse | GetMembersResponse['data']
  >(endpoints.forums.membersEdit, {
    params: { forum: params.forum },
  })

  return toDataResponse<GetMembersResponse['data']>(response, 'get members')
}

const saveMembers = async (
  payload: SaveMembersRequest
): Promise<SaveMembersResponse> => {
  const response = await requestHelpers.post<
    SaveMembersResponse | SaveMembersResponse['data'],
    SaveMembersRequest
  >(endpoints.forums.membersSave, payload, {
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

const viewPost = async (
  params: ViewPostParams
): Promise<ViewPostResponse> => {
  const response = await requestHelpers.get<
    ViewPostResponse | ViewPostResponse['data']
  >(endpoints.forums.postView, {
    params: { post: params.post },
  })

  return toDataResponse<ViewPostResponse['data']>(response, 'view post')
}

const votePost = async (
  payload: VotePostRequest
): Promise<VotePostResponse> => {
  const response = await requestHelpers.post<
    VotePostResponse | VotePostResponse['data'],
    VotePostRequest
  >(endpoints.forums.postVote, payload)

  return toDataResponse<VotePostResponse['data']>(response, 'vote post')
}

// ============================================================================
// Comment APIs
// ============================================================================

const getNewComment = async (
  params: GetNewCommentParams
): Promise<GetNewCommentResponse> => {
  const response = await requestHelpers.get<
    GetNewCommentResponse | GetNewCommentResponse['data']
  >(endpoints.forums.commentNew, {
    params: omitUndefined({
      forum: params.forum,
      post: params.post,
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
  const response = await requestHelpers.post<
    CreateCommentResponse | CreateCommentResponse['data'],
    CreateCommentRequest
  >(endpoints.forums.commentCreate, payload)

  return toDataResponse<CreateCommentResponse['data']>(
    response,
    'create comment'
  )
}

const voteComment = async (
  payload: VoteCommentRequest
): Promise<VoteCommentResponse> => {
  const response = await requestHelpers.post<
    VoteCommentResponse | VoteCommentResponse['data'],
    VoteCommentRequest
  >(endpoints.forums.commentVote, payload)

  return toDataResponse<VoteCommentResponse['data']>(
    response,
    'vote comment'
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
  getNewForum,
  subscribe: subscribeForum,
  unsubscribe: unsubscribeForum,
  getMembers,
  saveMembers,
  getNewPost,
  createPost,
  viewPost,
  votePost,
  getNewComment,
  createComment,
  voteComment,
}

export type {
  CreateCommentRequest,
  CreateCommentResponse,
  CreateForumRequest,
  CreateForumResponse,
  CreatePostRequest,
  CreatePostResponse,
  FindForumsResponse,
  GetNewCommentParams,
  GetNewCommentResponse,
  GetNewForumResponse,
  GetNewPostParams,
  GetNewPostResponse,
  ListForumsResponse,
  SearchForumsParams,
  SearchForumsResponse,
  SubscribeForumResponse,
  UnsubscribeForumResponse,
  ViewForumResponse,
  ViewPostParams,
  ViewPostResponse,
  VoteCommentRequest,
  VoteCommentResponse,
  VotePostRequest,
  VotePostResponse,
}

export default forumsApi
