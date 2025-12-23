const appBase = import.meta.env.VITE_APP_BASE_URL || '/forums'

const endpoints = {
  // Cross-app endpoints (proxied via forums backend)
  users: {
    search: `${appBase}/users/search`,
  },
  groups: {
    list: `${appBase}/groups`,
  },
  forums: {
    // Class-level endpoints (no entity context)
    // Must be absolute paths to avoid entity basepath interference
    list: `${appBase}/list`,
    create: `${appBase}/create`,
    find: `${appBase}/find`,
    new: `${appBase}/new`,
    search: `${appBase}/directory/search`,
    probe: `${appBase}/probe`,
    postNew: `${appBase}/post/new`,
    postCreate: `${appBase}/post/create`,

    // Entity-level endpoints (use /-/ separator)
    // Must be absolute paths to avoid entity basepath interference
    posts: (forumId: string) => `${appBase}/${forumId}/-/posts`,
    subscribe: (forumId: string) => `${appBase}/${forumId}/-/subscribe`,
    unsubscribe: (forumId: string) => `${appBase}/${forumId}/-/unsubscribe`,
    delete: (forumId: string) => `${appBase}/${forumId}/-/delete`,
    membersEdit: (forumId: string) => `${appBase}/${forumId}/-/members`,
    membersSave: (forumId: string) => `${appBase}/${forumId}/-/members/save`,

    // Post endpoints
    post: {
      view: (forumId: string, postId: string) => `${appBase}/${forumId}/-/${postId}`,
      edit: (forumId: string, postId: string) => `${appBase}/${forumId}/-/${postId}/edit`,
      delete: (forumId: string, postId: string) => `${appBase}/${forumId}/-/${postId}/delete`,
      vote: (forumId: string, postId: string, vote: 'up' | 'down' | '') =>
        `${appBase}/${forumId}/-/${postId}/vote/${vote || 'none'}`,
    },

    // Comment endpoints
    comment: {
      new: (forumId: string, postId: string) => `${appBase}/${forumId}/-/${postId}/comment`,
      create: (forumId: string, postId: string) => `${appBase}/${forumId}/-/${postId}/create`,
      edit: (forumId: string, postId: string, commentId: string) =>
        `${appBase}/${forumId}/-/${postId}/${commentId}/edit`,
      delete: (forumId: string, postId: string, commentId: string) =>
        `${appBase}/${forumId}/-/${postId}/${commentId}/delete`,
      vote: (forumId: string, postId: string, commentId: string, vote: 'up' | 'down' | '') =>
        `${appBase}/${forumId}/-/${postId}/${commentId}/vote/${vote || 'none'}`,
    },

    // Access control endpoints
    access: (forumId: string) => `${appBase}/${forumId}/-/access`,
    accessSet: (forumId: string) => `${appBase}/${forumId}/-/access/set`,
    accessRevoke: (forumId: string) => `${appBase}/${forumId}/-/access/revoke`,
  },
} as const

export type Endpoints = typeof endpoints

export default endpoints
