// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
//
// A community on another server - Lemmy, Mbin, PieFed or another Mochi
// server - found by the !name@host or link typed into Find, and joined as one
// of the user's own fediverse accounts here, which then posts, comments and
// votes in it.
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EntityAvatar,
  getErrorMessage,
  naturalCompare,
  toast,
} from '@mochi/web'
import { Loader2 } from 'lucide-react'
import forumsApi from '@/api/forums'
import { forumsKeys } from '@/hooks/use-forums-queries'
import { communityHandle } from '@/lib/community'

// What may name a community elsewhere: !name@host or @name@host, name@host,
// or a link that is not a Mochi forum's.
export function looksLikeCommunity(query: string): boolean {
  const q = query.trim()
  if (!q || /\s/.test(q) || /^mochi:/i.test(q) || q.includes('/forums/')) {
    return false
  }
  return /^https?:\/\//i.test(q) || /^[@!]?[^@/!]+@[^@/]+\.[^@/]+$/.test(q)
}

// The community a search names, as a result like the forums found here, with
// Join; where the user has more than one hosted account, Join asks which.
// found hears whether there is one, so the page says nothing was found only
// where there is not.
export function CommunityResult({
  query,
  found: told,
}: {
  query: string
  found?: (yes: boolean) => void
}) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const typed = looksLikeCommunity(query)
  const { data: listed } = useQuery({
    queryKey: ['forums', 'accounts', 'network'],
    queryFn: () => forumsApi.listAccounts('network'),
    enabled: typed,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const accounts = (listed ?? [])
    .filter((account) => account.type === 'fediverse' && account.hosted)
    .sort((a, b) => naturalCompare(a.identifier, b.identifier))
  const { data: found, isLoading } = useQuery({
    queryKey: ['forums', 'communities', 'lookup', query],
    queryFn: async () => (await forumsApi.lookupCommunity(query)).data,
    enabled: typed && accounts.length > 0,
    retry: false,
    refetchOnWindowFocus: false,
  })
  // The lookup on its way counts, so the page does not say first that nothing
  // was found.
  const shown = typed && accounts.length > 0 && (isLoading || !!found)
  useEffect(() => told?.(shown), [told, shown])
  if (!typed || accounts.length === 0) return null
  if (isLoading) {
    return (
      <div className='flex justify-center py-4'>
        <Loader2 className='text-muted-foreground size-5 animate-spin' />
      </div>
    )
  }
  if (!found) return null

  const join = async (account: string) => {
    setBusy(true)
    try {
      const answer = await forumsApi.joinCommunity(found.id, account)
      if (answer.data.already_subscribed) {
        toast.info(t`You are already subscribed to this forum`)
      } else {
        toast.success(t`Joined`)
      }
      await queryClient.invalidateQueries({ queryKey: forumsKeys.all })
      void navigate({
        to: '/$forum',
        params: { forum: answer.data.fingerprint || answer.data.id },
      })
    } catch (err) {
      toast.error(getErrorMessage(err, t`Could not join the community`))
    } finally {
      setBusy(false)
    }
  }

  const button = (
    <Button
      size='sm'
      loading={busy}
      onClick={
        accounts.length === 1 ? () => void join(accounts[0].id) : undefined
      }
      className='h-8 rounded-full px-4'
    >
      {/* button-icon-ok: Join has no conventional glyph, as Subscribe on the forums found beside it */}
      <Trans>Join</Trans>
    </Button>
  )

  return (
    <div
      className='group hover:bg-hover flex items-center justify-between gap-3 rounded-lg border border-transparent p-3 transition-all duration-200 hover:border-border hover:shadow-sm'
      data-testid='community-result'
    >
      <div className='flex min-w-0 items-center gap-3'>
        <EntityAvatar src={found.avatar || null} name={found.name} size='lg' />
        <div className='min-w-0'>
          <div className='mb-1 truncate text-sm leading-none font-medium'>
            {found.name}
          </div>
          {found.handle && (
            <div className='text-muted-foreground truncate text-xs opacity-80'>
              {communityHandle(found.handle)}
            </div>
          )}
        </div>
      </div>
      {accounts.length === 1 ? (
        button
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            {accounts.map((account) => (
              <DropdownMenuItem
                key={account.id}
                onSelect={() => void join(account.id)}
              >
                {account.identifier}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
