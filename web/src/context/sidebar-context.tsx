import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'

type SubscriptionState = {
  remote: boolean
  subscribed: boolean
  can_unsubscribe: boolean
}

type SidebarContextValue = {
  // Current forum tracking
  forum: string | null
  setForum: (id: string | null) => void

  // New post dialog
  post_dialog_open: boolean
  post_dialog_forum: string | null
  openPostDialog: (forum: string) => void
  closePostDialog: () => void

  // New forum dialog
  forum_dialog_open: boolean
  openForumDialog: () => void
  closeForumDialog: () => void

  // Subscription state and handlers for current forum
  subscription: SubscriptionState | null
  setSubscription: (state: SubscriptionState | null) => void
  subscribeHandler: React.MutableRefObject<(() => void) | null>
  unsubscribeHandler: React.MutableRefObject<(() => void) | null>
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [forum, setForum] = useState<string | null>(null)
  const [post_dialog_open, setPostDialogOpen] = useState(false)
  const [post_dialog_forum, setPostDialogForum] = useState<string | null>(null)
  const [forum_dialog_open, setForumDialogOpen] = useState(false)
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null)
  const subscribeHandler = useRef<(() => void) | null>(null)
  const unsubscribeHandler = useRef<(() => void) | null>(null)

  const openPostDialog = useCallback((targetForum: string) => {
    setPostDialogForum(targetForum)
    setPostDialogOpen(true)
  }, [])

  const closePostDialog = useCallback(() => {
    setPostDialogOpen(false)
    setPostDialogForum(null)
  }, [])

  const openForumDialog = useCallback(() => {
    setForumDialogOpen(true)
  }, [])

  const closeForumDialog = useCallback(() => {
    setForumDialogOpen(false)
  }, [])

  return (
    <SidebarContext.Provider value={{
      forum,
      setForum,
      post_dialog_open,
      post_dialog_forum,
      openPostDialog,
      closePostDialog,
      forum_dialog_open,
      openForumDialog,
      closeForumDialog,
      subscription,
      setSubscription,
      subscribeHandler,
      unsubscribeHandler,
    }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebarContext() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebarContext must be used within a SidebarProvider')
  }
  return context
}
