import { createFileRoute } from '@tanstack/react-router'
import { requestHelpers, GeneralError } from '@mochi/common'
import endpoints from '@/api/endpoints'
import type { Forum, ForumPermissions } from '@/api/types/forums'
import { EntityForumPage, ForumsListPage } from '@/features/forums/pages'

// Response type for info endpoint
interface InfoResponse {
  entity: boolean
  forums?: Forum[]
  forum?: Forum
  permissions?: ForumPermissions
  fingerprint?: string
}

export const Route = createFileRoute('/_authenticated/')({
  loader: async () => {
    return requestHelpers.get<InfoResponse>(endpoints.forums.info)
  },
  component: IndexPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function IndexPage() {
  const data = Route.useLoaderData()

  // If we're in entity context, show the forum page directly
  if (data.entity && data.forum) {
    return <EntityForumPage forum={data.forum} permissions={data.permissions} />
  }

  // Class context - show forums list
  return <ForumsListPage forums={data.forums} />
}

