// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { Link, useNavigate } from '@tanstack/react-router'
import { APP_ROUTES } from '@/config/routes'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button, EmptyState, Main, PageHeader } from '@mochi/web'
import { ArrowLeft, Hash } from 'lucide-react'
import type { ForumGoneReason } from '@/hooks/use-forum-websocket'

// Rendered in place of a forum whose owner removed this user from it, or
// deleted it, while the page was open: the local replica is already gone, so
// the page says why rather than failing on its next fetch.
export function ForumGone({ reason }: { reason: ForumGoneReason }) {
  const { t } = useLingui()
  const navigate = useNavigate()
  return (
    <>
      <PageHeader
        title={t`Forum`}
        back={{
          label: t`Back to forums`,
          onFallback: () => navigate({ to: APP_ROUTES.HOME }),
        }}
      />
      <Main>
        <div className='py-12'>
          <EmptyState
            icon={Hash}
            title={
              reason === 'removed'
                ? t`You were removed from this forum`
                : t`This forum was deleted`
            }
          >
            <Link to={APP_ROUTES.HOME}>
              <Button variant='outline'>
                <ArrowLeft className='size-4 rtl:rotate-180' />
                <Trans>Back to forums</Trans>
              </Button>
            </Link>
          </EmptyState>
        </div>
      </Main>
    </>
  )
}
