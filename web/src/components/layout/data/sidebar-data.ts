import { type SidebarData } from '@mochi/common'
import { MessageSquare, Plus } from 'lucide-react'

// Static sidebar data for CommandMenu (Cmd+K)
export const sidebarData: SidebarData = {
  navGroups: [
    {
      title: '',
      items: [
        { title: 'Forums', url: '/', icon: MessageSquare },
        { title: 'New forum', url: '/new', icon: Plus },
      ],
    },
  ],
}
