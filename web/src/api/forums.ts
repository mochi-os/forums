import { createAppClient } from '@mochi/common'
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
  InfoClassResponse,
  InfoEntityResponse,
  ListForumsResponse,
  RecommendationsResponse,
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

const client = createAppClient({ appName: 'forums' })

const omitUndefined = (
  params?: Record<string, string | number | undefined>
): Record<string, string> => {
  if (!params) return {}
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)])
  )
}

const forumsApi = {
  // Forums
  listForums: (sort?: string) =>
    client.get<ListForumsResponse>(endpoints.forums.list, {
      params: sort ? { sort } : undefined,
    }),

  getForumInfo: (forumId: string) =>
    client.get<InfoEntityResponse>(endpoints.forums.forumInfo(forumId)),

  getForumsInfo: () => client.get<InfoClassResponse>(endpoints.forums.info),

  viewForum: (params: ViewForumParams) =>
    client.get<ViewForumResponse>(endpoints.forums.posts(params.forum), {
      params: omitUndefined({
        limit: params.limit,
        before: params.before,
        server: params.server,
        sort: params.sort,
        tag: params.tag,
      }),
    }),

  createForum: (payload: CreateForumRequest) =>
    client.post<CreateForumResponse>(endpoints.forums.create, payload),

  findForums: () => client.get<FindForumsResponse>(endpoints.forums.find),

  searchForums: (params: SearchForumsParams) =>
    client.get<SearchForumsResponse>(endpoints.forums.search, {
      params: { search: params.search },
    }),

  getRecommendations: () =>
    client.get<RecommendationsResponse>(endpoints.forums.recommendations),

  probeForum: (params: ProbeForumRequest) =>
    client.post<ProbeForumResponse>(endpoints.forums.probe, { url: params.url }),

  getNewForum: () => client.get<GetNewForumResponse>(endpoints.forums.new),

  subscribeForum: (forumId: string, server?: string) =>
    client.post<SubscribeForumResponse>(endpoints.forums.subscribe(forumId), {
      forum: forumId,
      server,
    }),

  unsubscribeForum: (forumId: string) =>
    client.post<UnsubscribeForumResponse>(
      endpoints.forums.unsubscribe(forumId),
      {}
    ),

  getMembers: (params: GetMembersParams) =>
    client.get<GetMembersResponse>(endpoints.forums.membersEdit(params.forum)),

  saveMembers: (payload: SaveMembersRequest) => {
    const { forum, ...memberRoles } = payload
    return client.post<SaveMembersResponse>(
      endpoints.forums.membersSave(forum),
      memberRoles,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )
  },

  // Posts
  getNewPost: (params: GetNewPostParams) =>
    client.get<GetNewPostResponse>(endpoints.forums.postNew, {
      params: { forum: params.forum },
    }),

  createPost: (payload: CreatePostRequest) => {
    const formData = new FormData()
    formData.append('forum', payload.forum)
    formData.append('title', payload.title)
    formData.append('body', payload.body)
    if (payload.attachments) {
      payload.attachments.forEach((file) =>
        formData.append('attachments', file)
      )
    }
    return client.post<CreatePostResponse>(endpoints.forums.postCreate, formData)
  },

  viewPost: (params: ViewPostParams) =>
    client.get<ViewPostResponse>(
      endpoints.forums.post.view(params.forum, params.post),
      {
        params: omitUndefined({ server: params.server }),
      }
    ),

  votePost: (payload: VotePostRequest) =>
    client.post<VotePostResponse>(
      endpoints.forums.post.vote(payload.forum, payload.post, payload.vote),
      {}
    ),

  editPost: (payload: EditPostRequest) => {
    const formData = new FormData()
    formData.append('title', payload.title)
    formData.append('body', payload.body)
    if (payload.order) formData.append('order', JSON.stringify(payload.order))
    if (payload.attachments) {
      payload.attachments.forEach((file) =>
        formData.append('attachments', file)
      )
    }
    return client.post<EditPostResponse>(
      endpoints.forums.post.edit(payload.forum, payload.post),
      formData
    )
  },

  deletePost: (payload: DeletePostRequest) =>
    client.post<DeletePostResponse>(
      endpoints.forums.post.delete(payload.forum, payload.post),
      {}
    ),

  // Comments
  getNewComment: (params: GetNewCommentParams) =>
    client.get<GetNewCommentResponse>(
      endpoints.forums.comment.new(params.forum, params.post),
      {
        params: omitUndefined({ parent: params.parent }),
      }
    ),

  createComment: (payload: CreateCommentRequest & { files?: File[] }) => {
    const formData = new FormData()
    formData.append('forum', payload.forum)
    formData.append('post', payload.post)
    formData.append('body', payload.body)
    if (payload.parent) formData.append('parent', payload.parent)
    if (payload.files) {
      for (const file of payload.files) {
        formData.append('files', file)
      }
    }
    return client.post<CreateCommentResponse>(
      endpoints.forums.comment.create(payload.forum, payload.post),
      formData,
      { headers: { 'Content-Type': undefined } }
    )
  },

  voteComment: (payload: VoteCommentRequest) =>
    client.post<VoteCommentResponse>(
      endpoints.forums.comment.vote(
        payload.forum,
        payload.post,
        payload.comment,
        payload.vote
      ),
      {}
    ),

  editComment: (payload: EditCommentRequest) =>
    client.post<EditCommentResponse>(
      endpoints.forums.comment.edit(
        payload.forum,
        payload.post,
        payload.comment
      ),
      { body: payload.body }
    ),

  deleteComment: (payload: DeleteCommentRequest) =>
    client.post<DeleteCommentResponse>(
      endpoints.forums.comment.delete(
        payload.forum,
        payload.post,
        payload.comment
      ),
      {}
    ),

  // Access Control
  getAccess: (params: GetAccessParams) =>
    client.get<GetAccessResponse>(endpoints.forums.access(params.forum)),

  setAccess: (payload: SetAccessRequest) =>
    client.post<SetAccessResponse>(endpoints.forums.accessSet(payload.forum), {
      target: payload.user,
      level: payload.level,
    }),

  revokeAccess: (payload: RevokeAccessRequest) =>
    client.post<RevokeAccessResponse>(
      endpoints.forums.accessRevoke(payload.forum),
      { target: payload.user }
    ),

  // Management
  deleteForum: (forumId: string) =>
    client.post<{ data: Record<string, never> }>(
      endpoints.forums.delete(forumId),
      {}
    ),

  renameForum: (forumId: string, name: string) =>
    client.post<{ data: { success: boolean } }>(
      endpoints.forums.rename(forumId),
      { forum: forumId, name }
    ),

  // Search
  searchUsers: async (query: string) => {
    const formData = new URLSearchParams()
    formData.append('search', query)
    const results = await client.post<Array<{ id: string; name: string }>>(
      endpoints.users.search,
      formData,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    )
    return { data: { results } }
  },

  listGroups: async () => {
    const groups = await client.get<
      Array<{ id: string; name: string; description?: string }>
    >(endpoints.groups.list)
    return { data: { groups } }
  },

  // Moderation
  getModerationSettings: (params: GetModerationSettingsParams) =>
    client.get<GetModerationSettingsResponse>(
      endpoints.forums.moderation.settings(params.forum)
    ),

  saveModerationSettings: (payload: SaveModerationSettingsRequest) => {
    const { forum, ...settings } = payload
    const formData = new URLSearchParams()
    Object.entries(settings).forEach(([key, value]) => {
      formData.append(key, String(value))
    })
    return client.post<SaveModerationSettingsResponse>(
      endpoints.forums.moderation.settingsSave(forum),
      formData,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    )
  },

  getModerationQueue: (params: GetModerationQueueParams) =>
    client.get<GetModerationQueueResponse>(
      endpoints.forums.moderation.queue(params.forum)
    ),

  getModerationLog: (params: GetModerationLogParams) =>
    client.get<GetModerationLogResponse>(
      endpoints.forums.moderation.log(params.forum),
      {
        params: omitUndefined({
          limit: params.limit,
          before: params.before,
        }),
      }
    ),

  getReports: (params: GetReportsParams) =>
    client.get<GetReportsResponse>(
      endpoints.forums.moderation.reports(params.forum),
      {
        params: omitUndefined({ status: params.status }),
      }
    ),

  resolveReport: (payload: ResolveReportRequest) =>
    client.post<ResolveReportResponse>(
      endpoints.forums.moderation.resolveReport(payload.forum, payload.report),
      { action: payload.action }
    ),

  getRestrictions: (params: GetRestrictionsParams) =>
    client.get<GetRestrictionsResponse>(
      endpoints.forums.restrictions(params.forum)
    ),

  restrictUser: (payload: RestrictUserRequest) => {
    const { forum, ...data } = payload
    return client.post<RestrictUserResponse>(
      endpoints.forums.restrict(forum),
      data
    )
  },

  unrestrictUser: (payload: UnrestrictUserRequest) =>
    client.post<UnrestrictUserResponse>(
      endpoints.forums.unrestrict(payload.forum),
      { user: payload.user }
    ),

  removePost: (payload: RemovePostRequest) =>
    client.post<RemovePostResponse>(
      endpoints.forums.postModeration.remove(payload.forum, payload.post),
      { reason: payload.reason }
    ),

  restorePost: (payload: RestorePostRequest) =>
    client.post<RestorePostResponse>(
      endpoints.forums.postModeration.restore(payload.forum, payload.post),
      {}
    ),

  approvePost: (payload: ApprovePostRequest) =>
    client.post<ApprovePostResponse>(
      endpoints.forums.postModeration.approve(payload.forum, payload.post),
      {}
    ),

  lockPost: (payload: LockPostRequest) =>
    client.post<LockPostResponse>(
      endpoints.forums.postModeration.lock(payload.forum, payload.post),
      {}
    ),

  unlockPost: (payload: UnlockPostRequest) =>
    client.post<UnlockPostResponse>(
      endpoints.forums.postModeration.unlock(payload.forum, payload.post),
      {}
    ),

  pinPost: (payload: PinPostRequest) =>
    client.post<PinPostResponse>(
      endpoints.forums.postModeration.pin(payload.forum, payload.post),
      {}
    ),

  unpinPost: (payload: UnpinPostRequest) =>
    client.post<UnpinPostResponse>(
      endpoints.forums.postModeration.unpin(payload.forum, payload.post),
      {}
    ),

  reportPost: (payload: ReportPostRequest) =>
    client.post<ReportPostResponse>(
      endpoints.forums.postModeration.report(payload.forum, payload.post),
      { reason: payload.reason }
    ),

  removeComment: (payload: RemoveCommentRequest) =>
    client.post<RemoveCommentResponse>(
      endpoints.forums.commentModeration.remove(payload.forum, payload.post, payload.comment),
      { reason: payload.reason }
    ),

  restoreComment: (payload: RestoreCommentRequest) =>
    client.post<RestoreCommentResponse>(
      endpoints.forums.commentModeration.restore(payload.forum, payload.post, payload.comment),
      {}
    ),

  approveComment: (payload: ApproveCommentRequest) =>
    client.post<ApproveCommentResponse>(
      endpoints.forums.commentModeration.approve(payload.forum, payload.post, payload.comment),
      {}
    ),

  reportComment: (payload: ReportCommentRequest) =>
    client.post<ReportCommentResponse>(
      endpoints.forums.commentModeration.report(payload.forum, payload.post, payload.comment),
      { reason: payload.reason }
    ),

  getRssToken: (entity: string, mode: 'posts' | 'all') =>
    client.post<{ data: { token: string } }>(endpoints.forums.rssToken, { entity, mode }),

  // Tags
  addPostTag: async (forumId: string, postId: string, label: string) => {
    const res = await client.post<{ data: { id: string; label: string } }>(
      endpoints.forums.postTagsAdd(forumId, postId),
      { label }
    )
    return res.data
  },

  removePostTag: (forumId: string, postId: string, tagId: string) =>
    client.post(endpoints.forums.postTagsRemove(forumId, postId), { tag: tagId }),

  getForumTags: async (forumId: string) => {
    const res = await client.get<{ data: { tags: { label: string; count: number }[] } }>(
      endpoints.forums.tags(forumId)
    )
    return res.data.tags ?? []
  },

  setAiTagger: (forumId: string, account: number) => {
    const formData = new URLSearchParams()
    formData.append('account', String(account))
    return client.post(endpoints.forums.ai(forumId), formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  },
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
  InfoClassResponse,
  InfoEntityResponse,
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
