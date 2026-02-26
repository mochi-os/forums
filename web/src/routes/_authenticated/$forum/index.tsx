import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { z } from 'zod'
import { ApiError, GeneralError, Main, PageHeader } from '@mochi/common'
import { EntityForumPage } from '@/features/forums/pages'
import forumsApi from '@/api/forums'

const searchSchema = z.object({
  server: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/$forum/')({
  validateSearch: searchSchema,
  loader: async ({ params }) => {
    const { forum: forumId } = params
    let response: Awaited<ReturnType<typeof forumsApi.viewForum>>
    try {
      response = await forumsApi.viewForum({ forum: forumId })
    } catch (error) {
      const status = getErrorStatus(error)
      if (status === 403 || status === 404) {
        throw redirect({ to: '/' })
      }
      return {
        forum: null,
        permissions: undefined,
        loaderError:
          error instanceof Error ? error.message : 'Failed to load forum',
      }
    }

    if (!response.data?.forum) {
      throw redirect({ to: '/' })
    }

    return {
      forum: response.data.forum,
      permissions: {
        view: true,
        post: response.data.forum.can_post ?? false,
        manage: response.data.can_manage ?? false,
        moderate: response.data.can_moderate ?? false,
      },
      loaderError: null,
    }
  },
  component: ForumPage,
})

function ForumPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()

  if (!data.forum) {
    return (
      <>
        <PageHeader
          title='Forum'
          back={{ label: 'Back to forums', onFallback: () => navigate({ to: '/' }) }}
        />
        <Main>
          <GeneralError
            error={new Error(data.loaderError ?? 'Failed to load forum')}
            minimal
            mode='inline'
            reset={() => void router.invalidate()}
          />
        </Main>
      </>
    )
  }

  return <EntityForumPage forum={data.forum} permissions={data.permissions} />
}

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status
  }
  if (error && typeof error === 'object') {
    const maybeError = error as { status?: number; response?: { status?: number } }
    return maybeError.status ?? maybeError.response?.status
  }
  return undefined
}
