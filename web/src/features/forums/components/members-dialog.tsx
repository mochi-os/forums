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
import { MEMBER_ROLES } from '../constants'
import type { Member } from '@/api/types/forums'

type MemberRole = typeof MEMBER_ROLES[number]['value']

interface MembersDialogProps {
  forumId: string
  forumName: string
}

export function MembersDialog({ forumId, forumName }: MembersDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()

  // Track pending changes: memberId -> newRole
  const [pendingChanges, setPendingChanges] = useState<Record<string, MemberRole>>({})

  // Fetch members
  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['forums', 'members', forumId],
    queryFn: () => forumsApi.getMembers({ forum: forumId }),
    enabled: isOpen,
    staleTime: 0
  })

  const members = data?.data?.members || []

  // Reset pending changes when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setPendingChanges({})
    }
  }, [isOpen])

  // Save members mutation
  const saveMembersMutation = useMutation({
    mutationFn: forumsApi.saveMembers,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forums', 'members', forumId] })
    },
    onError: (error) => {
      toast.error('Failed to save member changes')
      console.error(error)
    }
  })

  // Handle role change
  const handleRoleChange = (memberId: string, newRole: string) => {
    setPendingChanges(prev => ({ ...prev, [memberId]: newRole as MemberRole }))
  }

  // Apply changes for a single member
  const applyChange = async (memberId: string, member: Member) => {
    const newRole = pendingChanges[memberId]

    if (newRole === undefined) return

    // Build the save request with the role update
    const payload = {
      forum: forumId,
      [`role_${memberId}`]: newRole,
    }

    await saveMembersMutation.mutateAsync(payload)
    toast.success(`Updated role for ${member.name}`)

    // Clear this pending change
    setPendingChanges(prev => {
      const next = { ...prev }
      delete next[memberId]
      return next
    })
  }

  const isPending = saveMembersMutation.isPending

  // Get effective role for display
  const getEffectiveRole = (member: Member): string => {
    if (pendingChanges[member.id] !== undefined) {
      return pendingChanges[member.id]
    }
    return member.role
  }

  // Check if member is an administrator (owner-like role)
  const isAdministrator = (member: Member): boolean => {
    return member.role === 'administrator'
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
            Manage roles for {forumName}
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
                {members.map((member: Member) => {
                  const effectiveRole = getEffectiveRole(member)
                  const isAdmin = isAdministrator(member)
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
                            {isAdmin && (
                              <Badge variant="secondary" className="text-[10px]">Admin</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">
                            {member.id.substring(0, 8)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Select
                          value={effectiveRole}
                          onValueChange={(val) => handleRoleChange(member.id, val)}
                          disabled={isPending}
                        >
                          <SelectTrigger className="w-[130px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MEMBER_ROLES.map((role) => (
                              <SelectItem key={role.value} value={role.value} className="text-xs">
                                {role.label}
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
