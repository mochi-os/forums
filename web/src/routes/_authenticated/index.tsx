import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { getErrorMessage } from '@mochi/common'
import forumsApi from '@/api/forums'
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
    let info: InfoResponse | null = null
    let loaderError: string | null = null

    try {
      const response = await forumsApi.getForumsInfo()
      // Backend returns { data: { entity, forums/forum, ... } }
      // createAppClient unwraps axios response.data, so response = { data: { entity, ... } }
      info = response.data as InfoResponse
    } catch (error) {
      loaderError = getErrorMessage(error, 'Failed to load forums')
    }

    // Only redirect on first load, not on subsequent navigations
    if (info && !hasCheckedRedirect) {
      hasCheckedRedirect = true

      // In class context, check for last visited forum and redirect if it still exists
      if (!info.entity) {
        const lastForumId = getLastForum()
        if (lastForumId) {
          const forums = info.forums || []
          const forumExists = forums.some(
            (f) => f.id === lastForumId || f.fingerprint === lastForumId
          )
          if (forumExists) {
            throw redirect({ to: '/$forum', params: { forum: lastForumId } })
          }
          clearLastForum()
        }
      }
    }

    return { info, loaderError }
  },
  component: IndexPage,
})

function IndexPage() {
  const { info, loaderError } = Route.useLoaderData()
  const router = useRouter()

  // If we're in entity context, show the forum page directly
  if (info?.entity && info.forum) {
    return (
      <EntityForumPage
        forum={info.forum}
        permissions={info.permissions}
        entityContext={true}
      />
    )
  }

  // Class context - show forums list
  return (
    <ForumsListPage
      forums={info?.forums}
      loaderError={loaderError}
      onRetryLoader={() => void router.invalidate()}
    />
  )
}
