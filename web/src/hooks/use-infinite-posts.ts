// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useEffect, useMemo } from 'react'
import {
  useInfiniteQuery,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import { getApiBasepath, requestHelpers } from '@mochi/web'
import forumsApi from '@/api/forums'
import type { Forum, Member } from '@/api/types/forums'
import type { Post } from '@/api/types/posts'

/** How many posts a page of a forum holds. */
export const POSTS_LIMIT = 20

/** Which list of a forum's posts: the forum, and how it is asked for. */
interface PostsList {
  forum: string | null
  limit?: number
  server?: string
  /** When true, uses getApiBasepath() for entity context (domain routing) */
  entityContext?: boolean
  sort?: string
  tag?: string
}

interface UseInfinitePostsOptions extends PostsList {
  enabled?: boolean
  /** The first page this navigation's route loader fetched, if it did. */
  seed?: PostsSeed
}

interface UseInfinitePostsResult {
  posts: Post[]
  forum: Forum | undefined
  member: Member | undefined
  can_manage: boolean
  can_moderate: boolean

  hasAi: boolean

  isLoading: boolean
  isError: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  fetchNextPage: () => void
  error: Error | null
  refetch: () => void
}

interface PageData {
  posts: Post[]
  forum: Forum | undefined
  member: Member | undefined
  can_manage: boolean
  can_moderate: boolean

  hasAi: boolean

  hasMore: boolean
  nextCursor: number | undefined
}

/** What the server answers a request for a page of posts with. */
interface PostsResponse {
  posts?: Post[]
  forum?: Forum
  member?: Member
  can_manage?: boolean
  can_moderate?: boolean

  hasAi?: boolean

  hasMore?: boolean
  nextCursor?: number | null
}

type PostsData = InfiniteData<PageData, number | undefined>

/** The query key of a list of a forum's posts. */
export function postsKey({
  forum,
  limit = POSTS_LIMIT,
  server,
  entityContext = false,
  sort,
  tag,
}: PostsList) {
  return [
    'forum-posts',
    forum,
    { limit, server, entityContext, sort, tag },
  ] as const
}

function toPage(data: PostsResponse): PageData {
  return {
    posts: data.posts ?? [],
    forum: data.forum,
    member: data.member,
    can_manage: data.can_manage ?? false,
    can_moderate: data.can_moderate ?? false,
    hasAi: data.hasAi ?? false,
    hasMore: data.hasMore ?? false,
    nextCursor: data.nextCursor ?? undefined,
  }
}

/** A first page of posts a route loader fetched for the page it opens. */
export interface PostsSeed {
  data: PostsData
}

// Seeds already shown. A seed is honoured once, by the page its navigation
// opens; a later mount of that page is a return, which shows what has changed
// since.
const spent = new WeakSet<PostsSeed>()

/**
 * Hold a first page of posts a route loader has fetched, so the page it opens
 * does not ask for it again. The response must answer the same request the
 * list makes for its first page, asked for at `asked`. A list is left alone
 * when a page already shows it (the reader's list changes only as the page
 * decides), when what it holds was fetched after this was asked for, or when
 * it holds further pages, which its page refetches on mount and a seed would
 * drop.
 */
export function seedPosts(
  client: QueryClient,
  list: PostsList,
  response: PostsResponse,
  asked: number
): PostsSeed | undefined {
  const key = postsKey(list)
  const query = client.getQueryCache().find({ queryKey: key, exact: true })
  if (query && query.getObserversCount() > 0) return undefined
  const state = client.getQueryState<PostsData>(key)
  if (state && state.dataUpdatedAt > asked) return undefined
  if (state?.data && state.data.pages.length > 1) return undefined
  const data = client.setQueryData<PostsData>(
    key,
    { pages: [toPage(response)], pageParams: [undefined] },
    { updatedAt: asked }
  )
  return data ? { data } : undefined
}

export function useInfinitePosts({
  forum,
  limit = POSTS_LIMIT,
  enabled = true,
  server,
  entityContext = false,
  sort,
  tag,
  seed,
}: UseInfinitePostsOptions): UseInfinitePostsResult {
  const query = useInfiniteQuery({
    queryKey: postsKey({ forum, limit, server, entityContext, sort, tag }),
    queryFn: async ({ pageParam }: { pageParam: number | undefined }) => {
      if (!forum) throw new Error('Forum ID required')

      let data: PostsResponse

      if (entityContext) {
        // In entity context (domain routing), use getApiBasepath() which returns /-/
        const params = new URLSearchParams()
        if (limit) params.set('limit', limit.toString())
        if (pageParam) params.set('before', pageParam.toString())
        if (server) params.set('server', server)
        if (sort) params.set('sort', sort)
        if (tag) params.set('tag', tag)
        const queryString = params.toString()
        const url =
          getApiBasepath() + 'posts' + (queryString ? `?${queryString}` : '')
        const response = await requestHelpers.get<PostsResponse>(url)
        data = response ?? {}
      } else {
        const response = await forumsApi.viewForum({
          forum,
          limit,
          before: pageParam,
          server,
          sort,
          tag,
        })
        data = response.data ?? {}
      }

      return toPage(data)
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage: PageData) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: enabled && !!forum,
    staleTime: 0,
    // Opening or returning to a forum shows what has changed since, so a mount
    // fetches the list again - unless it holds the first page this
    // navigation's loader has just fetched, and nothing has changed since (an
    // event invalidates it).
    refetchOnMount: (cached) =>
      seed !== undefined &&
      !spent.has(seed) &&
      cached.state.data === seed.data &&
      !cached.state.isInvalidated
        ? false
        : 'always',
    refetchOnWindowFocus: false,
    retry: 1,
  })

  // Declared after the query, so this runs once the query has subscribed and
  // made its mount-time decision.
  useEffect(() => {
    if (seed) spent.add(seed)
  }, [seed])

  // Flatten all pages into a single array of posts
  const posts = useMemo(() => {
    if (!query.data?.pages) return []
    return query.data.pages.flatMap((page: PageData) => page.posts)
  }, [query.data?.pages])

  // Get forum/member/permissions from first page (they don't change between pages)
  const forumData = query.data?.pages?.[0]?.forum
  const memberData = query.data?.pages?.[0]?.member
  const can_manage = query.data?.pages?.[0]?.can_manage ?? false
  const can_moderate = query.data?.pages?.[0]?.can_moderate ?? false
  const hasAi = query.data?.pages?.[0]?.hasAi ?? false

  return {
    posts,
    forum: forumData,
    member: memberData,
    can_manage,
    can_moderate,
    hasAi,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: !!query.hasNextPage,
    fetchNextPage: () => {
      void query.fetchNextPage()
    },
    error: (query.error as Error | null) ?? null,
    refetch: () => {
      void query.refetch()
    },
  }
}
