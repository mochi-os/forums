import { createFileRoute, redirect } from '@tanstack/react-router'
import { GeneralError } from '@mochi/common'
import endpoints from '@/api/endpoints'
import { forumsRequest } from '@/api/request'
import type { Forum, ForumPermissions } from '@/api/types/forums'
import { EntityForumPage, ForumsListPage } from '@/features/forums/pages'
import { getLastForum, clearLastForum } from '@/hooks/use-forums-storage'

// Response type for info endpoint
interface InfoResponse {
  entity: boolean
  forums?: Forum[]
  forum?: Forum
  permissions?: ForumPermissions
  fingerprint?: string
}

// Module-level flag to track if we've already done initial redirect check (resets on page refresh)
let hasCheckedRedirect = false

export const Route = createFileRoute('/_authenticated/')({
  loader: async () => {
    const info = await forumsRequest.get<InfoResponse>(endpoints.forums.info)

    // Only redirect on first load, not on subsequent navigations
    if (hasCheckedRedirect) {
      // Already checked this session - just return without redirect or clearing
      return info
    }
    hasCheckedRedirect = true

    // In class context, check for last visited forum and redirect if it still exists
    if (!info.entity) {
      const lastForumId = getLastForum()
      if (lastForumId) {
        const forums = info.forums || []
        const forumExists = forums.some(f => f.id === lastForumId || f.fingerprint === lastForumId)
        if (forumExists) {
          throw redirect({ to: '/$forum', params: { forum: lastForumId } })
        } else {
          clearLastForum()
        }
      }
    }

    return info
  },
  component: IndexPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function IndexPage() {
  const data = Route.useLoaderData()

  // If we're in entity context, show the forum page directly
  if (data.entity && data.forum) {
    return <EntityForumPage forum={data.forum} permissions={data.permissions} entityContext={true} />
  }

  // Class context - show forums list
  return <ForumsListPage forums={data.forums} />
}

