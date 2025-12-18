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
  ScrollArea
} from '@mochi/common'
import { Users, Save, Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { forumsApi } from '@/api/forums'
import { toast } from 'sonner'

const ROLES = [
  { value: 'disabled', label: 'Disabled' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'voter', label: 'Voter' },
  { value: 'commenter', label: 'Commenter' },
  { value: 'poster', label: 'Poster' },
  { value: 'administrator', label: 'Administrator' },
] as const

interface MembersDialogProps {
  forumId: string
  forumName: string
}

export function MembersDialog({ forumId, forumName }: MembersDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  
  // Local state for modified roles: memberId -> newRole
  const [modifiedRoles, setModifiedRoles] = useState<Record<string, string>>({})

  // Fetch members
  const { 
    data, 
    isLoading, 
    isError,
  } = useQuery({
    queryKey: ['forums', 'members', forumId],
    queryFn: () => forumsApi.getMembers({ forum: forumId }),
    enabled: isOpen, // Only fetch when dialog opens
    staleTime: 0 // Always fetch fresh
  })

  const members = data?.data?.members || []

  // Reset local state when dialog closes or opens
  useEffect(() => {
    if (isOpen) {
        setModifiedRoles({})
    }
  }, [isOpen])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: forumsApi.saveMembers,
    onSuccess: () => {
      toast.success('Member roles updated successfully')
      setModifiedRoles({})
      queryClient.invalidateQueries({ queryKey: ['forums', 'members', forumId] })
      setIsOpen(false)
    },
    onError: (error) => {
      toast.error('Failed to update member roles')
      console.error(error)
    }
  })

  // Handle role change
  const handleRoleChange = (memberId: string, newRole: string) => {
    setModifiedRoles((prev) => ({
      ...prev,
      [memberId]: newRole
    }))
  }

  // Handle save
  const handleSave = () => {
    const roleUpdates: Record<string, string> = {}
    
    // Construct payload strictly from modified items
    Object.entries(modifiedRoles).forEach(([memberId, role]) => {
      roleUpdates[`role_${memberId}`] = role
    })

    if (Object.keys(roleUpdates).length === 0) {
      setIsOpen(false)
      return
    }

    saveMutation.mutate({
        forum: forumId,
        ...roleUpdates
    })
  }

  const hasChanges = Object.keys(modifiedRoles).length > 0

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={setIsOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Users className="size-4" />
          Manage Members
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Manage Members</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            manage roles and permissions for {forumName}
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
               <div className="space-y-4">
                 {members.map((member) => {
                    const currentRole = modifiedRoles[member.id] || member.role
                    return (
                        <div key={member.id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                           <div className="flex items-center gap-3 overflow-hidden">
                             <Avatar className="size-9 border text-[10px]">
                               <AvatarFallback>
                                 {member.name.slice(0, 2).toUpperCase()}
                               </AvatarFallback>
                             </Avatar>
                             <div className="grid gap-0.5">
                               <p className="text-sm font-medium leading-none truncate max-w-[150px] sm:max-w-[200px]">
                                 {member.name}
                               </p>
                               <p className="text-xs text-muted-foreground font-mono">
                                 {member.id.substring(0, 8)}
                               </p>
                             </div>
                           </div>
                           
                           <Select 
                              value={currentRole} 
                              onValueChange={(val) => handleRoleChange(member.id, val)}
                           >
                             <SelectTrigger className="w-[140px] h-8 text-xs">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                                {ROLES.map((role) => (
                                    <SelectItem key={role.value} value={role.value} className="text-xs">
                                        {role.label}
                                    </SelectItem>
                                ))}
                             </SelectContent>
                           </Select>
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
            <div className="flex gap-2">
                <ResponsiveDialogClose asChild>
                    <Button variant="outline" size="sm">Cancel</Button>
                </ResponsiveDialogClose>
                <Button 
                    size="sm" 
                    onClick={handleSave} 
                    disabled={!hasChanges || saveMutation.isPending}
                >
                    {saveMutation.isPending ? (
                        <>
                           <Loader2 className="size-3 animate-spin mr-2" />
                           Saving...
                        </>
                    ) : (
                        <>
                           <Save className="size-3 mr-2" />
                           Save Changes
                        </>
                    )}
                </Button>
            </div>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
