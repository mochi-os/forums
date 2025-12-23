import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Button,
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogClose,
  AccessDialog,
  AccessList,
  type AccessLevel as CommonAccessLevel,
  type AccessRule,
  requestHelpers,
} from '@mochi/common'
import { Users, Plus } from 'lucide-react'
import {
  useUserSearch,
  useGroups,
} from '@/hooks/use-forums-queries'
import endpoints from '@/api/endpoints'
import type { MemberAccess, AccessLevelWithManage } from '@/api/types/forums'

interface MembersDialogProps {
  forumId: string
  forumName: string
}

// Forum access levels in hierarchical order
const FORUM_ACCESS_LEVELS: CommonAccessLevel[] = [
  { value: 'view', label: 'View only' },
  { value: 'vote', label: 'Vote' },
  { value: 'comment', label: 'Comment' },
  { value: 'post', label: 'Post' },
  { value: 'manage', label: 'Manage' },
  { value: 'none', label: 'No access' },
]

interface AccessResponse {
  forum: { id: string; name: string }
  access: MemberAccess[]
}

export function MembersDialog({ forumId, forumName }: MembersDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  // Access rules state
  const [rules, setRules] = useState<AccessRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // User search for AccessDialog
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const { data: userSearchData, isLoading: userSearchLoading } = useUserSearch(userSearchQuery)
  const { data: groupsData } = useGroups()

  // Load access rules
  const loadRules = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await requestHelpers.get<AccessResponse>(
        endpoints.forums.access(forumId)
      )

      // Map MemberAccess to AccessRule with isOwner flag
      const accessRules: AccessRule[] = (response?.access ?? [])
        .filter((member) => member.level !== null || member.isOwner)
        .map((member) => ({
          subject: member.id,
          operation: member.level ?? '*',
          grant: 1,
          name: member.name,
          isOwner: member.isOwner,
        }))

      setRules(accessRules)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load access rules'))
    } finally {
      setIsLoading(false)
    }
  }, [forumId])

  // Load rules when dialog opens
  useEffect(() => {
    if (isOpen) {
      void loadRules()
    }
  }, [isOpen, loadRules])

  // Add access handler
  const handleAdd = async (subject: string, subjectName: string, level: string) => {
    try {
      await requestHelpers.post(endpoints.forums.accessSet(forumId), {
        user: subject,
        level: level as AccessLevelWithManage,
      })
      toast.success(`Access set for ${subjectName}`)
      void loadRules()
    } catch {
      toast.error('Failed to set access')
    }
  }

  // Update access level handler
  const handleLevelChange = async (subject: string, level: string) => {
    try {
      await requestHelpers.post(endpoints.forums.accessSet(forumId), {
        user: subject,
        level: level as AccessLevelWithManage,
      })
      toast.success('Access updated')
      void loadRules()
    } catch {
      toast.error('Failed to update access')
    }
  }

  // Revoke access handler
  const handleRevoke = async (subject: string) => {
    try {
      await requestHelpers.post(endpoints.forums.accessRevoke(forumId), {
        user: subject,
      })
      toast.success('Access removed')
      void loadRules()
    } catch {
      toast.error('Failed to remove access')
    }
  }

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={setIsOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Users className="size-4" />
          Manage members
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Manage members</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Control who can access {forumName} and their permission levels.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex-1 overflow-auto py-4 space-y-4">
          {/* Add button */}
          <div className="flex justify-end">
            <Button onClick={() => setAddDialogOpen(true)} size="sm">
              <Plus className="size-4 mr-2" />
              Add
            </Button>
          </div>

          {/* Add access dialog */}
          <AccessDialog
            open={addDialogOpen}
            onOpenChange={setAddDialogOpen}
            onAdd={handleAdd}
            levels={FORUM_ACCESS_LEVELS.filter(l => l.value !== 'none')}
            defaultLevel="post"
            userSearchResults={userSearchData?.results ?? []}
            userSearchLoading={userSearchLoading}
            onUserSearch={setUserSearchQuery}
            groups={groupsData?.groups ?? []}
          />

          {/* Access list */}
          <AccessList
            rules={rules}
            levels={FORUM_ACCESS_LEVELS}
            onLevelChange={handleLevelChange}
            onRevoke={handleRevoke}
            isLoading={isLoading}
            error={error}
            selectWidth={150}
          />
        </div>

        <ResponsiveDialogFooter className="gap-2 sm:justify-between">
          <div className="text-xs text-muted-foreground self-center hidden sm:block">
            {rules.length} member{rules.length !== 1 ? 's' : ''}
          </div>
          <ResponsiveDialogClose asChild>
            <Button variant="outline" size="sm">Close</Button>
          </ResponsiveDialogClose>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
