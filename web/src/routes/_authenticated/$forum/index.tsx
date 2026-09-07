// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { t } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { EmptyState, GeneralError, Main, PageHeader, getErrorMessage } from '@mochi/web'
import { Hash } from 'lucide-react'
import { getErrorStatus } from '@/lib/errors'
import { EntityForumPage } from '@/features/forums/pages'
import forumsApi from '@/api/forums'

const searchSchema = z.object({
  server: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/$forum/')({
  validateSearch: searchSchema,
  // Carry ?server= into the loader so a remote forum is viewed against the
  // right server rather than being looked up locally and 404ing.
  loaderDeps: ({ search: { server } }) => ({ server }),
  loader: async ({ params, deps }) => {
    const { forum: forumId } = params
    const { server } = deps
    let response: Awaited<ReturnType<typeof forumsApi.viewForum>>
    try {
      response = await forumsApi.viewForum({ forum: forumId, server })
    } catch (error) {
      const status = getErrorStatus(error)
      if (status === 403 || status === 404) {
        // Don't bounce silently to the forums list: show a message so the user
        // knows the forum is gone or out of reach, rather than being teleported.
        return {
          forum: null,
          permissions: undefined,
          server,
          notFound: true,
          loaderError: null,
        }
      }
      return {
        forum: null,
        permissions: undefined,
        server,
        notFound: false,
        loaderError: getErrorMessage(error, t`Failed to load forum`),
      }
    }

    if (!response.data?.forum) {
      return {
        forum: null,
        permissions: undefined,
        server,
        notFound: true,
        loaderError: null,
      }
    }

    return {
      forum: response.data.forum,
      permissions: {
        view: true,
        post: response.data.forum.can_post ?? false,
        manage: response.data.can_manage ?? false,
        moderate: response.data.can_moderate ?? false,
      },
      server,
      notFound: false,
      loaderError: null,
    }
  },
  component: ForumPage,
})

function ForumPage() {
  const { t } = useLingui()
  const data = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()

  if (!data.forum) {
    return (
      <>
        <PageHeader
          title={t`Forum`}
          back={{ label: t`Back to forums`, onFallback: () => navigate({ to: '/' }) }}
        />
        <Main>
          {data.notFound ? (
            <div className='py-12'>
              <EmptyState
                icon={Hash}
                title={t`Forum not found`}
                description={t`This forum may have been deleted or you don't have access to it.`}
              />
            </div>
          ) : (
            <GeneralError
              error={new Error(data.loaderError ?? t`Failed to load forum`)}
              minimal
              mode='inline'
              reset={() => void router.invalidate()}
            />
          )}
        </Main>
      </>
    )
  }

  return (
    <EntityForumPage
      forum={data.forum}
      permissions={data.permissions}
      server={data.server}
    />
  )
}
