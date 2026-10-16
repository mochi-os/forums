// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
//
// What a sensitive post shows - its text, its link and its attachments - held
// behind a cover until the reader asks to see it.
import { useState, type ReactNode } from 'react'
import { Trans } from '@lingui/react/macro'
import { Button } from '@mochi/web'
import { EyeOff } from 'lucide-react'

export function SensitiveBadge() {
  return (
    <span className='bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium'>
      <EyeOff className='size-3' />
      <Trans context='content warning'>Sensitive</Trans>
    </span>
  )
}

export function SensitiveCover({
  sensitive,
  children,
}: {
  sensitive: boolean
  children: ReactNode
}) {
  const [shown, setShown] = useState(false)
  if (!sensitive || shown) return <>{children}</>
  return (
    <div className='bg-surface-2 flex items-center justify-between gap-3 rounded-lg p-3 text-sm'>
      <span className='text-muted-foreground'>
        <Trans>This post is marked sensitive</Trans>
      </span>
      <Button
        type='button'
        size='sm'
        variant='outline'
        onClick={(event) => {
          // A card opens its post on a click; showing is not opening.
          event.stopPropagation()
          setShown(true)
        }}
      >
        <Trans>Show</Trans>
      </Button>
    </div>
  )
}
