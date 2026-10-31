// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { z } from 'zod'
import type { QueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { t } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import {
  EmptyState,
  GeneralError,
  Main,
  PageHeader,
  getErrorMessage,
  useAuthStore,
} from '@mochi/web'
import { Hash } from 'lucide-react'
import forumsApi from '@/api/forums'
import type { InfoClassResponse } from '@/api/types/forums'
import { getErrorStatus } from '@/lib/errors'
import { forumsInfoQueryOptions } from '@/hooks/use-forums-queries'
import { POSTS_LIMIT, seedPosts } from '@/hooks/use-infinite-posts'
import { EntityForumPage } from '@/features/forums/pages'
import { initialSort } from '@/features/forums/sorts'

const searchSchema = z.object({
  server: z.string().optional(),
})

// The forum the last load was for. A load for it again while it is open is
// the page refreshing itself (the route invalidated), not a navigation.
let shown: string | undefined

// Sorts whose first page can take a while to answer: the server may rerank it
// with an AI model.
const SLOW = new Set(['ai', 'relevant'])

// The sort the page will open the forum's posts in, from what the layout's
// information query already holds. A forum it does not hold, or before it has
// loaded, opens in the reader's default or newest first, as the page does.
function expectedSort(client: QueryClient, forumId: string) {
  const info = client.getQueryData<InfoClassResponse>(
    forumsInfoQueryOptions().queryKey
  )
  const row = info?.data?.forums?.find(
    (f) => f.id === forumId || f.fingerprint === forumId
  )
  return initialSort(
    row?.sort,
    info?.data?.settings?.sort,
    useAuthStore.getState().isAuthenticated
  )
}

export async function loadForum({
  forum: forumId,
  server,
  client,
  cause,
}: {
  forum: string
  server?: string
  client: QueryClient
  cause: 'enter' | 'stay' | 'preload'
}) {
  const view = `${forumId} ${server ?? ''}`
  const again = cause === 'stay' && shown === view
  if (cause !== 'preload') shown = view

  // A navigation asks for the posts as the page will, so the answer is also
  // the page's first page, and the page shows it rather than asking again.
  // The page refreshing itself needs only the forum, and its list stays as
  // the reader has it. So does a sort that may be slow to answer: the
  // navigation waits for this request, so it asks for the forum alone, and
  // the page fetches its posts with its own loading state.
  const expected = expectedSort(client, forumId)
  const sort = again || SLOW.has(expected) ? undefined : expected
  const asked = Date.now()
  let response: Awaited<ReturnType<typeof forumsApi.viewForum>>
  try {
    response = await forumsApi.viewForum(
      sort
        ? { forum: forumId, server, limit: POSTS_LIMIT, sort }
        : { forum: forumId, server }
    )
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
        seed: undefined,
      }
    }
    return {
      forum: null,
      permissions: undefined,
      server,
      notFound: false,
      loaderError: getErrorMessage(error, t`Failed to load forum`),
      seed: undefined,
    }
  }

  if (!response.data?.forum) {
    return {
      forum: null,
      permissions: undefined,
      server,
      notFound: true,
      loaderError: null,
      seed: undefined,
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
    seed: sort
      ? seedPosts(
          client,
          { forum: response.data.forum.id, server, sort },
          response.data,
          asked
        )
      : undefined,
  }
}

export const Route = createFileRoute('/_authenticated/$forum/')({
  validateSearch: searchSchema,
  // Carry ?server= into the loader so a remote forum is viewed against the
  // right server rather than being looked up locally and 404ing.
  loaderDeps: ({ search: { server } }) => ({ server }),
  loader: ({ params, deps, context, cause }) =>
    loadForum({
      forum: params.forum,
      server: deps.server,
      client: context.queryClient,
      cause,
    }),
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
          back={{
            label: t`Back to forums`,
            onFallback: () => navigate({ to: '/' }),
          }}
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

  // Keyed by forum, so moving to another forum opens a fresh page - its own
  // sort, no tag filter or queued posts carried over - whose list mounts with
  // the first page the loader fetched.
  return (
    <EntityForumPage
      key={data.forum.id}
      forum={data.forum}
      permissions={data.permissions}
      server={data.server}
      seed={data.seed}
    />
  )
}
