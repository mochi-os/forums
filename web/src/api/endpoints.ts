// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { isDomainEntityRouting, getEntityFingerprint, path } from '@mochi/web'
// Relative, not '@/': lib/web's tests load this table outside the app, where
// '@' is lib/web's own source.
import { forumPath } from '../lib/forum-path'

// Get the base path for entity-level API calls
// In domain context, use '' (relative to root); otherwise use /{forumId}
// Note: createAppClient already adds /forums/ prefix via appName
//
// Every id goes in through path, as one encoded segment: a forum id comes from
// the address and a post, comment or report id from another server, and one
// holding a `/`, `?` or `..` would otherwise reach a different action. A
// community's address keeps its slashes out by going in as its fingerprint;
// any other value that cannot be one segment throws.
function getEntityBase(forumId: string): string {
  if (isDomainEntityRouting() && getEntityFingerprint() === forumId) {
    return ''
  }
  return path`/${forumPath(forumId)}`
}

const endpoints = {
  // Cross-app endpoints (proxied via forums backend)
  users: {
    search: '-/users/search',
  },
  groups: {
    list: '-/groups',
  },
  // Saved / read-later (class-level, per-user list spanning all forums)
  saved: {
    list: '-/saved/list',
    add: '-/saved/add',
    remove: '-/saved/remove',
    clear: '-/saved/clear',
  },
  forums: {
    // Class-level endpoints (no entity context)
    // These are relative - createAppClient adds /forums/ prefix
    info: '-/information',
    list: '-/list',
    create: '-/create',
    search: '-/directory/search',
    recommendations: '-/recommendations',
    probe: '-/probe',
    postCreate: '-/post/create',
    // Communities on other networks, through a linked Lemmy account
    communitiesAdd: '-/communities/add',
    communitiesImport: '-/communities/import',
    accounts: '-/accounts/list',
    // A community joined as one of the user's hosted accounts, and blocks of
    // people, communities and servers (phase 21)
    communitiesJoin: '-/communities/join',
    communitiesLookup: '-/communities/lookup',
    blocksAdd: '-/blocks/add',

    // Entity-level endpoints (use /-/ separator)
    // Use getEntityBase for domain-aware paths
    forumInfo: (forumId: string) => getEntityBase(forumId) + '/-/information',
    posts: (forumId: string) => getEntityBase(forumId) + '/-/posts',
    share: (forumId: string) => getEntityBase(forumId) + '/-/share',
    subscribe: (forumId: string) => getEntityBase(forumId) + '/-/subscribe',
    unsubscribe: (forumId: string) => getEntityBase(forumId) + '/-/unsubscribe',
    delete: (forumId: string) => getEntityBase(forumId) + '/-/delete',
    rename: (forumId: string) => getEntityBase(forumId) + '/-/rename',
    // The forum as a community on the fediverse (phase 20)
    publish: (forumId: string) => getEntityBase(forumId) + '/-/publish',
    publishSet: (forumId: string) => getEntityBase(forumId) + '/-/publish/set',
    publishClear: (forumId: string) =>
      getEntityBase(forumId) + '/-/publish/clear',
    bannerGet: (forumId: string) => getEntityBase(forumId) + '/-/banner/get',
    bannerSet: (forumId: string) => getEntityBase(forumId) + '/-/banner/set',
    sensitiveSet: (forumId: string) =>
      getEntityBase(forumId) + '/-/sensitive/set',
    membersSearch: (forumId: string) =>
      getEntityBase(forumId) + '/-/members/search',
    members: (forumId: string) => getEntityBase(forumId) + '/-/members',
    // Takes `remove=<member>`; the only owner-side way to take a member off the
    // fan-out and replay roster. Access revoke leaves both in place.
    membersSave: (forumId: string) =>
      getEntityBase(forumId) + '/-/members/save',

    // Post endpoints
    post: {
      view: (forumId: string, postId: string) =>
        getEntityBase(forumId) + path`/-/${postId}`,
      edit: (forumId: string, postId: string) =>
        getEntityBase(forumId) + path`/-/${postId}/edit`,
      delete: (forumId: string, postId: string) =>
        getEntityBase(forumId) + path`/-/${postId}/delete`,
      vote: (forumId: string, postId: string, vote: 'up' | 'down' | '') =>
        getEntityBase(forumId) + path`/-/${postId}/vote/${vote || 'none'}`,
    },

    // AI settings
    aiSettings: (forumId: string) => getEntityBase(forumId) + '/-/ai/settings',
    aiPromptsGet: (forumId: string) =>
      getEntityBase(forumId) + '/-/ai/prompts/get',
    aiPromptsSet: (forumId: string) =>
      getEntityBase(forumId) + '/-/ai/prompts/set',

    // Tag endpoints
    postTagsAdd: (forumId: string, postId: string) =>
      getEntityBase(forumId) + path`/-/${postId}/tags/add`,

    // Interest/scoring endpoints
    tagInterest: (forumId: string) =>
      getEntityBase(forumId) + '/-/tags/interest',

    // Comment endpoints
    comment: {
      create: (forumId: string, postId: string) =>
        getEntityBase(forumId) + path`/-/${postId}/create`,
      edit: (forumId: string, postId: string, commentId: string) =>
        getEntityBase(forumId) + path`/-/${postId}/${commentId}/edit`,
      delete: (forumId: string, postId: string, commentId: string) =>
        getEntityBase(forumId) + path`/-/${postId}/${commentId}/delete`,
      vote: (
        forumId: string,
        postId: string,
        commentId: string,
        vote: 'up' | 'down' | ''
      ) =>
        getEntityBase(forumId) +
        path`/-/${postId}/${commentId}/vote/${vote || 'none'}`,
    },

    // Access control endpoints
    access: (forumId: string) => getEntityBase(forumId) + '/-/access',
    accessSet: (forumId: string) => getEntityBase(forumId) + '/-/access/set',
    accessRevoke: (forumId: string) =>
      getEntityBase(forumId) + '/-/access/revoke',

    // Moderation endpoints
    moderation: {
      settings: (forumId: string) =>
        getEntityBase(forumId) + '/-/moderation/settings',
      settingsSave: (forumId: string) =>
        getEntityBase(forumId) + '/-/moderation/settings/save',
      queue: (forumId: string) =>
        getEntityBase(forumId) + '/-/moderation/queue',
      log: (forumId: string) => getEntityBase(forumId) + '/-/moderation/log',
      reports: (forumId: string) =>
        getEntityBase(forumId) + '/-/moderation/reports',
      resolveReport: (forumId: string, reportId: string) =>
        getEntityBase(forumId) +
        path`/-/moderation/reports/${reportId}/resolve`,
    },

    // Notifications
    notifications: (forumId: string) =>
      getEntityBase(forumId) + '/-/notifications',
    notificationsClear: (forumId: string) =>
      getEntityBase(forumId) + '/-/notifications/clear',
    notificationsSet: (forumId: string) =>
      getEntityBase(forumId) + '/-/notifications/set',

    // Sort persistence
    sortSet: '-/sort/set',
    forumSortSet: (forumId: string) => getEntityBase(forumId) + '/-/sort/set',

    // RSS
    rssToken: '-/rss/token',
    rssTokenRevoke: '-/rss/token/revoke',

    // User restrictions
    restrict: (forumId: string) => getEntityBase(forumId) + '/-/restrict',
    unrestrict: (forumId: string) => getEntityBase(forumId) + '/-/unrestrict',
    restrictions: (forumId: string) =>
      getEntityBase(forumId) + '/-/restrictions',

    // Post moderation actions
    postModeration: {
      remove: (forumId: string, postId: string) =>
        getEntityBase(forumId) + path`/-/${postId}/remove`,
      restore: (forumId: string, postId: string) =>
        getEntityBase(forumId) + path`/-/${postId}/restore`,
      approve: (forumId: string, postId: string) =>
        getEntityBase(forumId) + path`/-/${postId}/approve`,
      lock: (forumId: string, postId: string) =>
        getEntityBase(forumId) + path`/-/${postId}/lock`,
      unlock: (forumId: string, postId: string) =>
        getEntityBase(forumId) + path`/-/${postId}/unlock`,
      pin: (forumId: string, postId: string) =>
        getEntityBase(forumId) + path`/-/${postId}/pin`,
      unpin: (forumId: string, postId: string) =>
        getEntityBase(forumId) + path`/-/${postId}/unpin`,
      report: (forumId: string, postId: string) =>
        getEntityBase(forumId) + path`/-/${postId}/report`,
      follow: (forumId: string, postId: string) =>
        getEntityBase(forumId) + path`/-/${postId}/follow`,
      unfollow: (forumId: string, postId: string) =>
        getEntityBase(forumId) + path`/-/${postId}/unfollow`,
    },

    // Comment moderation actions
    commentModeration: {
      remove: (forumId: string, postId: string, commentId: string) =>
        getEntityBase(forumId) + path`/-/${postId}/${commentId}/remove`,
      restore: (forumId: string, postId: string, commentId: string) =>
        getEntityBase(forumId) + path`/-/${postId}/${commentId}/restore`,
      approve: (forumId: string, postId: string, commentId: string) =>
        getEntityBase(forumId) + path`/-/${postId}/${commentId}/approve`,
      report: (forumId: string, postId: string, commentId: string) =>
        getEntityBase(forumId) + path`/-/${postId}/${commentId}/report`,
    },
  },
} as const

export default endpoints
