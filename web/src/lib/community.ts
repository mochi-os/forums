// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

// A community on another network is named by its title, which two communities
// can share ("test" on lemmy.ml and on sh.itjust.works), so where it is named
// its server goes beside it, and its page header gives its handle in full.

/** The server a community lives on: its handle's host (name@host), else its
 *  address's; none for a forum of ours, whose id is not a web address. */
export function communityServer(
  handle?: string,
  address?: string
): string | undefined {
  const at = handle ? handle.lastIndexOf('@') : -1
  if (handle && at > 0 && at < handle.length - 1) return handle.slice(at + 1)
  if (address && /^https?:\/\//i.test(address)) {
    try {
      return new URL(address).hostname
    } catch {
      return undefined
    }
  }
  return undefined
}

/** A community's handle as its network writes one, !name@host. */
export function communityHandle(handle?: string): string | undefined {
  return handle ? `!${handle}` : undefined
}

/** The server to show beside a forum's name: a community's, whose id is its
 *  address; never a forum of ours, whose id is an entity's, even one published
 *  as a group with an address of its own. */
export function forumServer(forum: {
  id: string
  handle?: string
}): string | undefined {
  return communityServer(forum.handle, forum.id)
}
