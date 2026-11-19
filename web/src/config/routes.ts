// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { guardParams, paramShapes } from '@mochi/web'

export const APP_ROUTES = {
  HOME: '/',
} as const

// A forum is named in an address by its fingerprint (a community's included)
// or its entity id, and a post by its id. The router hands a route its
// parameters percent-decoded, and the thread page put `$post` into the path it
// requests, so `/forums/<fingerprint>/delete` GETs the forum's delete action
// and an encoded `/` or `?` reaches any other with inputs. Anything else
// renders not-found and its page asks for nothing.
const forum = [paramShapes.fingerprint, paramShapes.entity]

/** The `params.parse` of a route under `$forum`. */
export const parseForumParams = guardParams({ forum })

/** The `params.parse` of the `$forum/$post` route. */
export const parsePostParams = guardParams({ forum, post: paramShapes.id })
