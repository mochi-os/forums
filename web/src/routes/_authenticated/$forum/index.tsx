import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { GeneralError, requestHelpers } from '@mochi/common'
import type { Forum, ForumPermissions } from '@/api/types/forums'
import { EntityForumPage } from '@/features/forums/pages'
import endpoints from '@/api/endpoints'

const searchSchema = z.object({
  server: z.string().optional(),
})

// Response type for posts endpoint - includes forum data
interface PostsResponse {
  forum?: Forum
  permissions?: ForumPermissions
  posts: unknown[]
  hasMore: boolean
  cursor?: number
}

export const Route = createFileRoute('/_authenticated/$forum/')({
  validateSearch: searchSchema,
  loader: async ({ params }) => {
    const { forum: forumId } = params
    // Use the posts endpoint to get forum info (it returns forum data + posts)
    const response = await requestHelpers.get<PostsResponse>(
      endpoints.forums.posts(forumId)
    )
    return {
      forum: response.forum,
      permissions: response.permissions,
    }
  },
  component: ForumPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function ForumPage() {
  const data = Route.useLoaderData()

  if (!data.forum) {
    throw new Error('Forum not found')
  }

  return <EntityForumPage forum={data.forum} permissions={data.permissions} />
}
