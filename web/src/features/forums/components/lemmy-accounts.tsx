// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
//
// The user's linked Lemmy accounts on the Find page: each brings its
// subscribed communities into forums, or imports its settings export - the
// followed communities, the blocked instances and the saved posts.
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Button,
  getErrorMessage,
  naturalCompare,
  providerName,
  toast,
} from '@mochi/web'
import { Download, Plus } from 'lucide-react'
import forumsApi from '@/api/forums'
import { forumsKeys } from '@/hooks/use-forums-queries'

export function LemmyAccounts() {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const { data } = useQuery({
    queryKey: ['forums', 'accounts', 'lemmy'],
    queryFn: () => forumsApi.listAccounts('social'),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const accounts = (data ?? [])
    .filter((account) => account.type === 'lemmy' && !account.hosted)
    .sort((a, b) => naturalCompare(a.identifier, b.identifier))
  if (accounts.length === 0) return null

  const add = async (account: string) => {
    setBusy(account)
    try {
      const answer = await forumsApi.addCommunities(account)
      toast.success(
        plural(answer.added, {
          one: 'Added # community',
          other: 'Added # communities',
        })
      )
      await queryClient.invalidateQueries({ queryKey: forumsKeys.all })
    } catch (err) {
      toast.error(getErrorMessage(err, t`Could not add the communities`))
    } finally {
      setBusy(null)
    }
  }

  const importSettings = async (account: string) => {
    setBusy(account)
    try {
      const answer = await forumsApi.importCommunities(account)
      toast.success(
        answer.more
          ? t`Imported ${answer.communities} communities, ${answer.blocks} blocks and ${answer.saved} saved posts so far; the rest follow`
          : t`Imported ${answer.communities} communities, ${answer.blocks} blocks and ${answer.saved} saved posts`
      )
      await queryClient.invalidateQueries({ queryKey: forumsKeys.all })
    } catch (err) {
      toast.error(getErrorMessage(err, t`Could not import`))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className='mb-6' data-testid='lemmy-accounts'>
      <p className='text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase'>
        <Trans>Your communities elsewhere</Trans>
      </p>
      <div className='space-y-1'>
        {accounts.map((account) => (
          <div
            key={account.id}
            className='flex items-center justify-between gap-3 rounded-lg p-3'
          >
            <div className='min-w-0'>
              <div className='truncate text-sm font-medium'>
                {account.identifier}
              </div>
              <div className='text-muted-foreground text-xs'>
                {providerName(account.type)}
              </div>
            </div>
            <div className='flex shrink-0 items-center gap-2'>
              <Button
                size='sm'
                variant='outline'
                loading={busy === account.id}
                onClick={() => void importSettings(account.id)}
              >
                <Download className='size-4' />
                <Trans>Import settings</Trans>
              </Button>
              <Button
                size='sm'
                loading={busy === account.id}
                icon={<Plus className='size-4' />}
                onClick={() => void add(account.id)}
              >
                <Trans>Add communities</Trans>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
