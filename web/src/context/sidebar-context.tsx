// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'

type SidebarContextValue = {
  // New post dialog
  postDialogOpen: boolean
  postDialogForum: string | null
  openPostDialog: (forum: string) => void
  closePostDialog: () => void

  // New forum dialog
  forumDialogOpen: boolean
  openForumDialog: () => void
  closeForumDialog: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [postDialogOpen, setPostDialogOpen] = useState(false)
  const [postDialogForum, setPostDialogForum] = useState<string | null>(null)
  const [forumDialogOpen, setForumDialogOpen] = useState(false)

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
    <SidebarContext.Provider
      value={{
        postDialogOpen,
        postDialogForum,
        openPostDialog,
        closePostDialog,
        forumDialogOpen,
        openForumDialog,
        closeForumDialog,
      }}
    >
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
