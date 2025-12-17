// Static endpoints
const staticEndpoints = {
  list: '/forums/list',
  create: '/forums/create',
  find: '/forums/find',
  new: '/forums/new',
  search: '/forums/search',
  postNew: '/forums/post/new',
  postCreate: '/forums/post/create',
} as const

// Entity-aware path builders
const dynamicEndpoints = {
  // Subscribe/Unsubscribe: POST /forums/{forumId}/subscribe
  subscribe: (forumId: string) => `/forums/${forumId}/subscribe`,
  unsubscribe: (forumId: string) => `/forums/${forumId}/unsubscribe`,

  // Members: GET /forums/{forumId}/members, POST /forums/{forumId}/members/save
  membersEdit: (forumId: string) => `/forums/${forumId}/members`,
  membersSave: (forumId: string) => `/forums/${forumId}/members/save`,

  // View forum: GET /forums/{forumId}
  forumView: (forumId: string) => `/forums/${forumId}`,

  // View post: GET /forums/{forumId}/{postId}
  postView: (forumId: string, postId: string) => `/forums/${forumId}/${postId}`,

  // Vote post: POST /forums/{forumId}/{postId}/vote
  postVote: (forumId: string, postId: string) => `/forums/${forumId}/${postId}/vote`,

  // Comment form: GET /forums/{forumId}/{postId}/comment
  commentNew: (forumId: string, postId: string) => `/forums/${forumId}/${postId}/comment`,

  // Create comment: POST /forums/{forumId}/{postId}/create
  commentCreate: (forumId: string, postId: string) => `/forums/${forumId}/${postId}/create`,

  // Vote comment: POST /forums/{forumId}/{postId}/{commentId}/vote/{vote}
  commentVote: (forumId: string, postId: string, commentId: string, vote: 'up' | 'down') =>
    `/forums/${forumId}/${postId}/${commentId}/vote/${vote}`,
}

const endpoints = {
  forums: {
    ...staticEndpoints,
    ...dynamicEndpoints,
  },
}

export type Endpoints = typeof endpoints

export default endpoints
