import { useState, useEffect } from 'react'
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Avatar,
  AvatarFallback,
  ScrollArea,
  Badge,
} from '@mochi/common'
import { Users, Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { forumsApi } from '@/api/forums'
import { toast } from 'sonner'
import { ACCESS_LEVELS } from '../constants'
import type { MemberAccess, AccessLevelWithManage } from '@/api/types/forums'

interface MembersDialogProps {
  forumId: string
  forumName: string
}

export function MembersDialog({ forumId, forumName }: MembersDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()

  // Track pending changes: memberId -> newLevel (null = revoke)
  const [pendingChanges, setPendingChanges] = useState<Record<string, AccessLevelWithManage | null>>({})

  // Fetch access rules
  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['forums', 'access', forumId],
    queryFn: () => forumsApi.getAccess({ forum: forumId }),
    enabled: isOpen,
    staleTime: 0
  })

  const members = data?.data?.access || []

  // Reset pending changes when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setPendingChanges({})
    }
  }, [isOpen])

  // Set access mutation
  const setAccessMutation = useMutation({
    mutationFn: forumsApi.setAccess,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forums', 'access', forumId] })
    },
    onError: (error) => {
      toast.error('Failed to update access')
      console.error(error)
    }
  })

  // Revoke access mutation
  const revokeAccessMutation = useMutation({
    mutationFn: forumsApi.revokeAccess,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forums', 'access', forumId] })
    },
    onError: (error) => {
      toast.error('Failed to revoke access')
      console.error(error)
    }
  })

  // Handle access level change
  const handleAccessChange = (memberId: string, newLevel: string) => {
    if (newLevel === 'none') {
      setPendingChanges(prev => ({ ...prev, [memberId]: null }))
    } else {
      setPendingChanges(prev => ({ ...prev, [memberId]: newLevel as AccessLevelWithManage }))
    }
  }

  // Apply a single change immediately
  const applyChange = async (memberId: string, member: MemberAccess) => {
    const newLevel = pendingChanges[memberId]

    if (newLevel === undefined) return

    if (newLevel === null) {
      // Revoke access
      await revokeAccessMutation.mutateAsync({ forum: forumId, user: memberId })
      toast.success(`Revoked access for ${member.name}`)
    } else {
      // Set new access level
      await setAccessMutation.mutateAsync({ forum: forumId, user: memberId, level: newLevel })
      toast.success(`Updated access for ${member.name}`)
    }

    // Clear this pending change
    setPendingChanges(prev => {
      const next = { ...prev }
      delete next[memberId]
      return next
    })
  }

  const isPending = setAccessMutation.isPending || revokeAccessMutation.isPending

  // Get effective access level for display
  const getEffectiveLevel = (member: MemberAccess): string => {
    if (pendingChanges[member.id] !== undefined) {
      return pendingChanges[member.id] === null ? 'none' : pendingChanges[member.id]!
    }
    return member.level || 'owner'
  }

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={setIsOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Users className="size-4" />
          Manage members
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Manage members</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Manage access levels for {forumName}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex-1 overflow-hidden py-4">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="flex h-40 items-center justify-center text-destructive">
              Failed to load members
            </div>
          ) : members.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              No members found
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {members.map((member) => {
                  const effectiveLevel = getEffectiveLevel(member)
                  const isOwner = member.level === null
                  const hasChange = pendingChanges[member.id] !== undefined

                  return (
                    <div key={member.id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Avatar className="size-9 border text-[10px]">
                          <AvatarFallback>
                            {member.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="grid gap-0.5">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium leading-none truncate max-w-[150px] sm:max-w-[200px]">
                              {member.name}
                            </p>
                            {isOwner && (
                              <Badge variant="secondary" className="text-[10px]">Owner</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">
                            {member.id.substring(0, 8)}
                          </p>
                        </div>
                      </div>

                      {isOwner ? (
                        <span className="text-xs text-muted-foreground">Full access</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Select
                            value={effectiveLevel}
                            onValueChange={(val) => handleAccessChange(member.id, val)}
                            disabled={isPending}
                          >
                            <SelectTrigger className="w-[120px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs text-destructive">
                                No access
                              </SelectItem>
                              {ACCESS_LEVELS.map((level) => (
                                <SelectItem key={level.value} value={level.value} className="text-xs">
                                  {level.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {hasChange && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() => applyChange(member.id, member)}
                              disabled={isPending}
                            >
                              {isPending ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                'Apply'
                              )}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        <ResponsiveDialogFooter className="gap-2 sm:justify-between">
          <div className="text-xs text-muted-foreground self-center hidden sm:block">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </div>
          <ResponsiveDialogClose asChild>
            <Button variant="outline" size="sm">Close</Button>
          </ResponsiveDialogClose>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
