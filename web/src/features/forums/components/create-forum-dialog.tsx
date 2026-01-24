import { useNavigate } from '@tanstack/react-router'
import { CreateEntityDialog, type CreateEntityValues } from '@mochi/common'
import { MessageSquare } from 'lucide-react'
import { useCreateForum } from '@/hooks/use-forums-queries'

type CreateForumDialogProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}

export function CreateForumDialog({
  open,
  onOpenChange,
  hideTrigger,
}: CreateForumDialogProps) {
  const navigate = useNavigate()
  const createForum = useCreateForum()

  const handleSubmit = async (values: CreateEntityValues) => {
    return new Promise<void>((resolve, reject) => {
      createForum.mutate(
        { name: values.name, privacy: values.privacy ?? 'public' },
        {
          onSuccess: (response) => {
            const forum = response.data?.fingerprint ?? response.data?.id
            if (forum) {
              void navigate({ to: '/$forum', params: { forum } })
            }
            resolve()
          },
          onError: (error) => {
            reject(error)
          },
        }
      )
    })
  }

  return (
    <CreateEntityDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={MessageSquare}
      title="Create forum"
      entityLabel="Forum"
      showPrivacyToggle
      privacyLabel="Allow anyone to search for forum"
      onSubmit={handleSubmit}
      isPending={createForum.isPending}
      hideTrigger={hideTrigger}
    />
  )
}
