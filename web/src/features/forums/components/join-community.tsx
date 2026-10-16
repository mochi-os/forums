// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
//
// Joining a community on another server - Lemmy, Mbin, PieFed or another
// Mochi server - by its !name@host, as one of the user's own fediverse
// accounts here, which then posts, comments and votes in it.
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  getErrorMessage,
  naturalCompare,
  toast,
} from '@mochi/web'
import forumsApi from '@/api/forums'
import { forumsKeys } from '@/hooks/use-forums-queries'

export function JoinCommunity() {
  const { t } = useLingui()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [address, setAddress] = useState('')
  const [chosen, setChosen] = useState('')
  const [busy, setBusy] = useState(false)
  const { data } = useQuery({
    queryKey: ['forums', 'accounts', 'network'],
    queryFn: () => forumsApi.listAccounts('network'),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const accounts = (data ?? [])
    .filter((account) => account.type === 'fediverse' && account.hosted)
    .sort((a, b) => naturalCompare(a.identifier, b.identifier))
  if (accounts.length === 0) return null
  const account = chosen || accounts[0].id

  const join = async () => {
    if (!address.trim()) return
    setBusy(true)
    try {
      const answer = await forumsApi.joinCommunity(address.trim(), account)
      if (answer.data.already_subscribed) {
        toast.info(t`You are already subscribed to this forum`)
      } else {
        toast.success(t`Joined`)
      }
      setAddress('')
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

  return (
    <div className='mb-6' data-testid='join-community'>
      <p className='text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase'>
        <Trans>Join a community elsewhere</Trans>
      </p>
      <form
        className='flex flex-col gap-2 sm:flex-row'
        onSubmit={(event) => {
          event.preventDefault()
          void join()
        }}
      >
        <Input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder='!name@example.org'
          aria-label={t`Community address`}
          disabled={busy}
          className='sm:flex-1'
        />
        {accounts.length > 1 && (
          <Select value={account} onValueChange={setChosen} disabled={busy}>
            <SelectTrigger aria-label={t`Account`} className='sm:w-56'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.identifier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          type='submit'
          variant='outline'
          loading={busy}
          disabled={!address.trim()}
        >
          <Trans>Join</Trans>
        </Button>
      </form>
    </div>
  )
}
