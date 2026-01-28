import { useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { requestHelpers, getApiBasepath } from '@mochi/common'
import { forumsApi } from '@/api/forums'
import type { Forum, Member } from '@/api/types/forums'
import type { Post } from '@/api/types/posts'

const DEFAULT_LIMIT = 20

interface UseInfinitePostsOptions {
  forum: string | null
  limit?: number
  enabled?: boolean
  server?: string
  /** When true, uses getApiBasepath() for entity context (domain routing) */
  entityContext?: boolean
  sort?: string
}

interface UseInfinitePostsResult {
  posts: Post[]
  forum: Forum | undefined
  member: Member | undefined
  can_manage: boolean
  can_moderate: boolean
  isLoading: boolean
  isError: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  fetchNextPage: () => void
  error: Error | null
  refetch: () => void
}

export function useInfinitePosts({
  forum,
  limit = DEFAULT_LIMIT,
  enabled = true,
  server,
  entityContext = false,
  sort,
}: UseInfinitePostsOptions): UseInfinitePostsResult {
  const query = useInfiniteQuery({
    queryKey: ['forum-posts', forum, { limit, server, entityContext, sort }],
    queryFn: async ({ pageParam }) => {
      if (!forum) throw new Error('Forum ID required')

      let data: {
        posts?: Post[]
        forum?: Forum
        member?: Member
        can_manage?: boolean
        can_moderate?: boolean
        hasMore?: boolean
        nextCursor?: number | null
      }

      if (entityContext) {
        // In entity context (domain routing), use getApiBasepath() which returns /-/
        const params = new URLSearchParams()
        if (limit) params.set('limit', limit.toString())
        if (pageParam) params.set('before', pageParam.toString())
        if (server) params.set('server', server)
        if (sort) params.set('sort', sort)
        const queryString = params.toString()
        const url = getApiBasepath() + 'posts' + (queryString ? `?${queryString}` : '')
        const response = await requestHelpers.get<{
          posts?: Post[]
          forum?: Forum
          member?: Member
          can_manage?: boolean
          can_moderate?: boolean
          hasMore?: boolean
          nextCursor?: number | null
        }>(url)
        data = response ?? {}
      } else {
        const response = await forumsApi.view({
          forum,
          limit,
          before: pageParam as number | undefined,
          server,
          sort,
        })
        data = response.data ?? {}
      }

      return {
        posts: data.posts ?? [],
        forum: data.forum,
        member: data.member,
        can_manage: data.can_manage ?? false,
        can_moderate: data.can_moderate ?? false,
        hasMore: data.hasMore ?? false,
        nextCursor: data.nextCursor ?? undefined,
      }
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled: enabled && !!forum,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    retry: 1,
  })

  // Flatten all pages into a single array of posts
  const posts = useMemo(() => {
    if (!query.data?.pages) return []
    return query.data.pages.flatMap((page) => page.posts)
  }, [query.data?.pages])

  // Get forum/member/permissions from first page (they don't change between pages)
  const forumData = query.data?.pages?.[0]?.forum
  const memberData = query.data?.pages?.[0]?.member
  const can_manage = query.data?.pages?.[0]?.can_manage ?? false
  const can_moderate = query.data?.pages?.[0]?.can_moderate ?? false

  return {
    posts,
    forum: forumData,
    member: memberData,
    can_manage,
    can_moderate,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    error: query.error,
    refetch: query.refetch,
  }
}
