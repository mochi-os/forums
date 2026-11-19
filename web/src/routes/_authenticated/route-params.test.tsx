// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
// The thread page GETs `<forum>/-/<post>` with the reader's token, and the
// forum's own actions live beside `:forum/-/:post`, so the plain link
// `/forums/<fingerprint>/delete` deleted the forum when its owner followed it;
// an encoded `/` or `?` reached any other action with inputs. Each route
// answers not-found for a parameter that is not a forum address or a post id,
// before its loader or page runs.
import { QueryClient } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  type AnyRoute,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Route as PostRoute } from './$forum/$post'
import { Route as ForumRoute } from './$forum/index'
import { Route as ModerationRoute } from './$forum_.moderation'
import { Route as SettingsRoute } from './$forum_.settings'

const { viewForum, getForumsInfo, pages } = vi.hoisted(() => ({
  viewForum: vi.fn(),
  getForumsInfo: vi.fn(),
  pages: [] as string[],
}))

vi.mock('@/api/forums', () => ({
  default: { viewForum, getForumsInfo, getNotifications: vi.fn() },
}))
vi.mock('@/features/forums/pages', () => ({ EntityForumPage: () => null }))

const ENTITY = '1sfEACmTnQhBVgquGhaCs8Jw4SXKF9XY2apnUwJ63duq2QSxh5'
const FINGERPRINT = 'va7kZSfKM'
const POST = '0193a1b2c3d4e5f60718293a4b5c6d7e'

// A page that says it rendered: every request these routes make is made by
// their page or their loader, so a page that never renders asked for nothing.
function page(name: string) {
  return function Page() {
    pages.push(name)
    return <p>{name}</p>
  }
}

function options(route: AnyRoute) {
  return route.options as {
    params?: unknown
    loaderDeps?: unknown
    loader?: unknown
  }
}

function open(address: string) {
  const root = createRootRoute({
    component: Outlet,
    notFoundComponent: () => <p>not found</p>,
  })
  const child = (path: string, route: AnyRoute, loader = false) =>
    createRoute({
      getParentRoute: () => root,
      path,
      params: options(route).params as never,
      loaderDeps: loader ? (options(route).loaderDeps as never) : undefined,
      loader: loader ? (options(route).loader as never) : undefined,
      component: page(path),
    })
  const router = createRouter({
    routeTree: root.addChildren([
      child('$forum', ForumRoute, true),
      child('$forum/$post', PostRoute),
      child('$forum/moderation', ModerationRoute),
      child('$forum/settings', SettingsRoute),
    ]),
    history: createMemoryHistory({ initialEntries: [address] }),
    context: { queryClient: new QueryClient() },
  })
  return render(<RouterProvider router={router} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  pages.length = 0
  viewForum.mockResolvedValue({
    data: { forum: { id: ENTITY, name: 'Forum' }, posts: [] },
  })
  getForumsInfo.mockResolvedValue({ forums: [] })
})

describe('forum routes', () => {
  it.each([
    ['a climb to delete', `/${ENTITY}%2F-%2Fdelete`],
    ['a climb with inputs', `/${FINGERPRINT}%5C-%5Crename%3Fname%3Dx`],
    ['a community address', `/https%3A%2F%2Flemmy.ml%2Fc%2Ftest`],
  ])('refuse %s with no request', async (_name, address) => {
    open(address)
    expect(await screen.findByText('not found')).toBeTruthy()
    expect(viewForum).not.toHaveBeenCalled()
    expect(getForumsInfo).not.toHaveBeenCalled()
    expect(pages).toEqual([])
  })

  it.each([
    ['a post that names a forum action', `/${FINGERPRINT}/delete`],
    ['a post that names another', `/${FINGERPRINT}/unsubscribe`],
    [
      'a post that climbs with inputs',
      `/${FINGERPRINT}/access%2Fset%3Ftarget%3D${ENTITY}%26level%3Dmoderate`,
    ],
    ['a post under a forum that climbs', `/${ENTITY}%2F-%2Fdelete/${POST}`],
    ['moderation of a forum that climbs', `/${ENTITY}%2F-%2Fdelete/moderation`],
    ['settings of a forum that climbs', `/${ENTITY}%5C-%5Cdelete/settings`],
  ])('refuse %s before the page renders', async (_name, address) => {
    open(address)
    expect(await screen.findByText('not found')).toBeTruthy()
    expect(pages).toEqual([])
  })

  // CONTROL: the same routes open what they are given.
  it.each([
    ['a forum by entity id', `/${ENTITY}`, '$forum'],
    ['a forum by fingerprint', `/${FINGERPRINT}`, '$forum'],
    ['a thread', `/${FINGERPRINT}/${POST}`, '$forum/$post'],
    ['moderation', `/${ENTITY}/moderation`, '$forum/moderation'],
    ['settings', `/va7-kZS-fKM/settings`, '$forum/settings'],
  ])('open %s', async (_name, address, name) => {
    open(address)
    expect(await screen.findByText(name)).toBeTruthy()
    if (name === '$forum') expect(viewForum).toHaveBeenCalledTimes(1)
  })
})
