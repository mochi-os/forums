import { useState } from 'react'
import { MessageSquarePlus, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/ui/responsive-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { memberAccessOptions } from '../constants'

type CreateForumDialogProps = {
  onCreate: (input: { name: string; memberAccess: string; allowSearch: boolean }) => void
}

type CreateForumFormState = {
  name: string
  memberAccess: string
  allowSearch: boolean
}

export function CreateForumDialog({ onCreate }: CreateForumDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState<CreateForumFormState>({
    name: '',
    memberAccess: 'full-access',
    allowSearch: true,
  })

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim()) return

    onCreate(form)
    setForm({
      name: '',
      memberAccess: 'full-access',
      allowSearch: true,
    })
    setIsOpen(false)
  }

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={setIsOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button size='sm' className='text-sm'>
          <MessageSquarePlus className='size-4' />
          Create forum
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className='sm:max-w-[520px]'>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>New Forum</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Create a new forum space for your community.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form className='space-y-4' onSubmit={handleSubmit}>
          <div className='space-y-2'>
            <Label htmlFor='forum-name'>Forum name</Label>
            <Input
              id='forum-name'
              placeholder='Forum name'
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='forum-member-access'>New members may</Label>
            <Select
              value={form.memberAccess}
              onValueChange={(value) => setForm((prev) => ({ ...prev, memberAccess: value }))}
            >
              <SelectTrigger id='forum-member-access' className='w-full justify-between'>
                <SelectValue placeholder='Select access level' />
              </SelectTrigger>
              <SelectContent>
                {memberAccessOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex items-center justify-between rounded-lg border px-4 py-3'>
            <div className='space-y-1'>
              <Label htmlFor='forum-search-visibility' className='text-sm font-medium'>
                Allow anyone to search for forum
              </Label>
              <p className='text-xs text-muted-foreground'>
                Keep the forum discoverable across workspaces.
              </p>
            </div>
            <Switch
              id='forum-search-visibility'
              checked={form.allowSearch}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, allowSearch: checked }))}
            />
          </div>
          <ResponsiveDialogFooter className='gap-2'>
            <ResponsiveDialogClose asChild>
              <Button type='button' variant='outline'>
                Cancel
              </Button>
            </ResponsiveDialogClose>
            <Button type='submit' disabled={!form.name.trim()}>
              <Check className='size-4' />
              Create
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
