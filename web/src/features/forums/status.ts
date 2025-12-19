import { BadgeCheck } from 'lucide-react'
import type { ThreadStatus } from './constants'

export const threadStatusStyles: Record<
  ThreadStatus,
  { label: string; className: string; icon: typeof BadgeCheck }
> = {
  open: {
    label: 'Open',
    className: 'text-green-400 bg-green-400/10 border-green-400/20',
    icon: BadgeCheck,
  },
  resolved: {
    label: 'Resolved',
    className: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    icon: BadgeCheck,
  },
  announcement: {
    label: 'Announcement',
    className: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    icon: BadgeCheck,
  },
}
