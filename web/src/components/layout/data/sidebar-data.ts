import { type SidebarData } from '@mochi/web'
import { useLingui } from '@lingui/react/macro'
import { MessageSquare, Plus } from 'lucide-react'

// Static sidebar data for CommandMenu (Cmd+K)
export function useSidebarData(): SidebarData {
  const { t } = useLingui()
  return {
    navGroups: [
      {
        title: '',
        items: [
          { title: t`All forums`, url: '/', icon: MessageSquare },
          { title: t`New forum`, url: '/new', icon: Plus },
        ],
      },
    ],
  }
}
