// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { forumPath } from '../lib/forum-path'
import endpoints from './endpoints'

const routing = vi.hoisted(() => ({ domain: false, fingerprint: '' }))

vi.mock('@mochi/web', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mochi/web')>()),
  isDomainEntityRouting: () => routing.domain,
  getEntityFingerprint: () => routing.fingerprint,
}))

afterEach(() => {
  routing.domain = false
  routing.fingerprint = ''
})

type Build = (...ids: string[]) => string

// One builder of each shape the table has: a forum, a forum and a post (with
// and without a vote), a forum, a post and a comment (with and without a
// vote), and a forum and a report. Each with the path a normal id gave before
// the ids went through path.
const forums = endpoints.forums
const shapes: Array<[string, Build, number, string]> = [
  ['forumInfo', (forum) => forums.forumInfo(forum), 1, '/f1/-/information'],
  ['post.view', (forum, post) => forums.post.view(forum, post), 2, '/f1/-/p1'],
  [
    'post.vote',
    (forum, post) => forums.post.vote(forum, post, ''),
    2,
    '/f1/-/p1/vote/none',
  ],
  [
    'postModeration.lock',
    (forum, post) => forums.postModeration.lock(forum, post),
    2,
    '/f1/-/p1/lock',
  ],
  [
    'comment.edit',
    (forum, post, comment) => forums.comment.edit(forum, post, comment),
    3,
    '/f1/-/p1/c1/edit',
  ],
  [
    'comment.vote',
    (forum, post, comment) => forums.comment.vote(forum, post, comment, 'up'),
    3,
    '/f1/-/p1/c1/vote/up',
  ],
  [
    'moderation.resolveReport',
    (forum, report) => forums.moderation.resolveReport(forum, report),
    2,
    '/f1/-/moderation/reports/p1/resolve',
  ],
]

const normal = ['f1', 'p1', 'c1']
const refused = ['.', '..', '']
// Each holds a slash: refused as a post, comment or report id, and taken as a
// community's address, named by its fingerprint, as a forum id.
const slashed = ['../delete', 'a/b']

function replaced(position: number, value: string): string[] {
  return normal.map((id, i) => (i === position ? value : id))
}

describe.each(shapes)('%s', (_, build, ids, before) => {
  it('builds the same path for normal ids', () => {
    expect(build(...normal)).toBe(before)
  })

  for (let position = 0; position < ids; position++) {
    it.each(refused)(`refuses %j in id ${position + 1}`, (value) => {
      expect(() => build(...replaced(position, value))).toThrow(/path: refused/)
    })

    it(`keeps a query in id ${position + 1} inside its segment`, () => {
      const built = build(...replaced(position, 'x?y=1'))
      expect(built).toContain('x%3Fy%3D1')
      expect(built).not.toContain('?')
    })
  }

  it.each(slashed)('names a forum id of %j by its fingerprint', (value) => {
    const built = build(...replaced(0, value))
    expect(built.startsWith(`/${forumPath(value)}/-/`)).toBe(true)
    expect(built).not.toContain('..')
  })

  for (let position = 1; position < ids; position++) {
    it.each(slashed)(`refuses %j in id ${position + 1}`, (value) => {
      expect(() => build(...replaced(position, value))).toThrow(/path: refused/)
    })
  }
})

describe('a community', () => {
  it('is named by its fingerprint, one segment, in place of its address', () => {
    const address = 'https://lemmy.example/c/tech'
    const fingerprint = forumPath(address)
    expect(fingerprint).toMatch(/^[0-9A-Za-z]{9}$/)
    expect(forums.post.edit(address, 'p1')).toBe(`/${fingerprint}/-/p1/edit`)
  })
})

describe('domain routing', () => {
  it("addresses the domain's own forum from the root", () => {
    routing.domain = true
    routing.fingerprint = 'f1'
    expect(forums.forumInfo('f1')).toBe('/-/information')
    expect(forums.comment.delete('f1', 'p1', 'c1')).toBe('/-/p1/c1/delete')
    expect(() => forums.comment.delete('f1', '..', 'c1')).toThrow(
      /path: refused/
    )
  })

  it('addresses any other forum by its own segment', () => {
    routing.domain = true
    routing.fingerprint = 'f1'
    expect(forums.forumInfo('f2')).toBe('/f2/-/information')
  })
})
