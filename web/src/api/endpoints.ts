import { isDomainEntityContext, getDomainEntityFingerprint } from '@mochi/common'

const appBase = import.meta.env.VITE_APP_BASE_URL || '/forums'

// Get the base path for entity-level API calls
// In domain context, use '' (relative to root); otherwise use /forums/{forumId}
function getEntityBase(forumId: string): string {
  const domainFingerprint = getDomainEntityFingerprint()
  if (isDomainEntityContext('forum') && domainFingerprint === forumId) {
    return ''
  }
  return `${appBase}/${forumId}`
}

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
    info: `${appBase}/info`,
    list: `${appBase}/list`,
    create: `${appBase}/create`,
    find: `${appBase}/find`,
    new: `${appBase}/new`,
    search: `${appBase}/directory/search`,
    recommendations: `${appBase}/recommendations`,
    probe: `${appBase}/probe`,
    postNew: `${appBase}/post/new`,
    postCreate: `${appBase}/post/create`,

    // Entity-level endpoints (use /-/ separator)
    // Use getEntityBase for domain-aware paths
    posts: (forumId: string) => `${getEntityBase(forumId)}/-/posts`,
    subscribe: (forumId: string) => `${getEntityBase(forumId)}/-/subscribe`,
    unsubscribe: (forumId: string) => `${getEntityBase(forumId)}/-/unsubscribe`,
    delete: (forumId: string) => `${getEntityBase(forumId)}/-/delete`,
    rename: (forumId: string) => `${getEntityBase(forumId)}/-/rename`,
    membersEdit: (forumId: string) => `${getEntityBase(forumId)}/-/members`,
    membersSave: (forumId: string) => `${getEntityBase(forumId)}/-/members/save`,

    // Post endpoints
    post: {
      view: (forumId: string, postId: string) =>
        `${getEntityBase(forumId)}/-/${postId}`,
      edit: (forumId: string, postId: string) =>
        `${getEntityBase(forumId)}/-/${postId}/edit`,
      delete: (forumId: string, postId: string) =>
        `${getEntityBase(forumId)}/-/${postId}/delete`,
      vote: (forumId: string, postId: string, vote: 'up' | 'down' | '') =>
        `${getEntityBase(forumId)}/-/${postId}/vote/${vote || 'none'}`,
    },

    // Comment endpoints
    comment: {
      new: (forumId: string, postId: string) =>
        `${getEntityBase(forumId)}/-/${postId}/comment`,
      create: (forumId: string, postId: string) =>
        `${getEntityBase(forumId)}/-/${postId}/create`,
      edit: (forumId: string, postId: string, commentId: string) =>
        `${getEntityBase(forumId)}/-/${postId}/${commentId}/edit`,
      delete: (forumId: string, postId: string, commentId: string) =>
        `${getEntityBase(forumId)}/-/${postId}/${commentId}/delete`,
      vote: (
        forumId: string,
        postId: string,
        commentId: string,
        vote: 'up' | 'down' | ''
      ) =>
        `${getEntityBase(forumId)}/-/${postId}/${commentId}/vote/${vote || 'none'}`,
    },

    // Access control endpoints
    access: (forumId: string) => `${getEntityBase(forumId)}/-/access`,
    accessSet: (forumId: string) => `${getEntityBase(forumId)}/-/access/set`,
    accessRevoke: (forumId: string) => `${getEntityBase(forumId)}/-/access/revoke`,

    // Moderation endpoints
    moderation: {
      settings: (forumId: string) =>
        `${getEntityBase(forumId)}/-/moderation/settings`,
      settingsSave: (forumId: string) =>
        `${getEntityBase(forumId)}/-/moderation/settings/save`,
      queue: (forumId: string) =>
        `${getEntityBase(forumId)}/-/moderation/queue`,
      log: (forumId: string) =>
        `${getEntityBase(forumId)}/-/moderation/log`,
      reports: (forumId: string) =>
        `${getEntityBase(forumId)}/-/moderation/reports`,
      resolveReport: (forumId: string, reportId: string) =>
        `${getEntityBase(forumId)}/-/moderation/reports/${reportId}/resolve`,
    },

    // User restrictions
    restrict: (forumId: string) => `${getEntityBase(forumId)}/-/restrict`,
    unrestrict: (forumId: string) => `${getEntityBase(forumId)}/-/unrestrict`,
    restrictions: (forumId: string) => `${getEntityBase(forumId)}/-/restrictions`,

    // Post moderation actions
    postModeration: {
      remove: (forumId: string, postId: string) =>
        `${getEntityBase(forumId)}/-/${postId}/remove`,
      restore: (forumId: string, postId: string) =>
        `${getEntityBase(forumId)}/-/${postId}/restore`,
      approve: (forumId: string, postId: string) =>
        `${getEntityBase(forumId)}/-/${postId}/approve`,
      lock: (forumId: string, postId: string) =>
        `${getEntityBase(forumId)}/-/${postId}/lock`,
      unlock: (forumId: string, postId: string) =>
        `${getEntityBase(forumId)}/-/${postId}/unlock`,
      pin: (forumId: string, postId: string) =>
        `${getEntityBase(forumId)}/-/${postId}/pin`,
      unpin: (forumId: string, postId: string) =>
        `${getEntityBase(forumId)}/-/${postId}/unpin`,
      report: (forumId: string, postId: string) =>
        `${getEntityBase(forumId)}/-/${postId}/report`,
    },

    // Comment moderation actions
    commentModeration: {
      remove: (forumId: string, postId: string, commentId: string) =>
        `${getEntityBase(forumId)}/-/${postId}/${commentId}/remove`,
      restore: (forumId: string, postId: string, commentId: string) =>
        `${getEntityBase(forumId)}/-/${postId}/${commentId}/restore`,
      approve: (forumId: string, postId: string, commentId: string) =>
        `${getEntityBase(forumId)}/-/${postId}/${commentId}/approve`,
      report: (forumId: string, postId: string, commentId: string) =>
        `${getEntityBase(forumId)}/-/${postId}/${commentId}/report`,
    },
  },
} as const

export type Endpoints = typeof endpoints

export default endpoints
