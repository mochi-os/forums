const endpoints = {
  // Cross-app endpoints (proxied via forums backend)
  users: {
    search: '/forums/-/users/search',
  },
  groups: {
    list: '/forums/-/groups',
  },
  forums: {
    // Class-level endpoints (no entity context)
    list: '/forums/list',
    create: '/forums/create',
    find: '/forums/find',
    new: '/forums/new',
    search: '/forums/search',
    postNew: '/forums/post/new',
    postCreate: '/forums/post/create',

    // Entity-level endpoints (use /-/ separator)
    posts: (forumId: string) => `/forums/${forumId}/-/posts`,
    subscribe: (forumId: string) => `/forums/${forumId}/-/subscribe`,
    unsubscribe: (forumId: string) => `/forums/${forumId}/-/unsubscribe`,
    membersEdit: (forumId: string) => `/forums/${forumId}/-/members`,
    membersSave: (forumId: string) => `/forums/${forumId}/-/members/save`,

    // Post endpoints
    post: {
      view: (forumId: string, postId: string) => `/forums/${forumId}/-/${postId}`,
      vote: (forumId: string, postId: string, vote: 'up' | 'down') =>
        `/forums/${forumId}/-/${postId}/vote/${vote}`,
    },

    // Comment endpoints
    comment: {
      new: (forumId: string, postId: string) => `/forums/${forumId}/-/${postId}/comment`,
      create: (forumId: string, postId: string) => `/forums/${forumId}/-/${postId}/create`,
      vote: (forumId: string, postId: string, commentId: string, vote: 'up' | 'down') =>
        `/forums/${forumId}/-/${postId}/${commentId}/vote/${vote}`,
    },

    // Access control endpoints
    access: (forumId: string) => `/forums/${forumId}/-/access`,
    accessSet: (forumId: string) => `/forums/${forumId}/-/access/set`,
    accessRevoke: (forumId: string) => `/forums/${forumId}/-/access/revoke`,
  },
} as const

export type Endpoints = typeof endpoints

export default endpoints
