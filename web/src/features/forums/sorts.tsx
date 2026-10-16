// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
//
// The sorts forums offers beyond the shared ones, as communities on other
// networks offer them.
import { useMemo } from 'react'
import { useLingui } from '@lingui/react/macro'
import type { SortOption } from '@mochi/web'
import { Activity, History, MessagesSquare, Scale, Swords } from 'lucide-react'

export function useForumSorts(): SortOption[] {
  const { t } = useLingui()
  return useMemo(
    () => [
      {
        value: 'active',
        label: t({ message: 'Active', context: 'sort order' }),
        icon: <Activity className='size-4' />,
      },
      {
        value: 'scaled',
        label: t({ message: 'Scaled', context: 'sort order' }),
        icon: <Scale className='size-4' />,
      },
      {
        value: 'controversial',
        label: t({ message: 'Controversial', context: 'sort order' }),
        icon: <Swords className='size-4' />,
      },
      {
        value: 'old',
        label: t({ message: 'Old', context: 'sort order' }),
        icon: <History className='size-4' />,
      },
      {
        value: 'comments',
        label: t({ message: 'Most comments', context: 'sort order' }),
        icon: <MessagesSquare className='size-4' />,
      },
    ],
    [t]
  )
}
