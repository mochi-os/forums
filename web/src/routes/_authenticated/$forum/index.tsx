import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { GeneralError } from '@mochi/common'
import { EntityForumPage } from '@/features/forums/pages'
import forumsApi from '@/api/forums'

const searchSchema = z.object({
  server: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/$forum/')({
  validateSearch: searchSchema,
  loader: async ({ params }) => {
    const { forum: forumId } = params
    const response = await forumsApi.viewForum({ forum: forumId })
    return {
      forum: response.data?.forum,
      permissions: response.data ? {
        view: true,
        post: response.data.forum?.can_post ?? false,
        manage: response.data.can_manage ?? false,
        moderate: response.data.can_moderate ?? false,
      } : undefined,
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
