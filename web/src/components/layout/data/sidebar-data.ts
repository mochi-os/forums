import { MessageSquare, Search, Plus } from 'lucide-react'
import { type SidebarData } from '@mochi/common'

// Static sidebar data for CommandMenu (Cmd+K)
export const sidebarData: SidebarData = {
  navGroups: [
    {
      title: '',
      items: [
        { title: 'All forums', url: '/', icon: MessageSquare },
        { title: 'Search', url: '/search', icon: Search },
        { title: 'New forum', url: '/new', icon: Plus },
      ],
    },
  ],
}
