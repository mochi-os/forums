import { useState, useMemo } from 'react'
import { MessageSquarePlus, Check } from 'lucide-react'
import {
  Button,
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@mochi/common'
import { memberAccessOptions } from '../constants'

// Characters disallowed in forum names (matches backend validation)
const DISALLOWED_NAME_CHARS = /[<>\r\n\\;"'`]/

function validateForumName(name: string): string | null {
  if (!name.trim()) {
    return null // Empty is handled separately
  }
  if (DISALLOWED_NAME_CHARS.test(name)) {
    return 'Name cannot contain < > \\ ; " \' or ` characters'
  }
  if (name.length > 1000) {
    return 'Name must be 1000 characters or less'
  }
  return null
}

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

  const nameError = useMemo(() => validateForumName(form.name), [form.name])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim() || nameError) return

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
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              aria-invalid={!!nameError}
            />
            {nameError && (
              <p className='text-sm text-destructive'>{nameError}</p>
            )}
          </div>
          <div className='space-y-2'>
            <Label htmlFor='forum-member-access'>New members may</Label>
            <Select
              value={form.memberAccess}
              onValueChange={(value: string) => setForm((prev) => ({ ...prev, memberAccess: value }))}
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
              onCheckedChange={(checked: boolean) => setForm((prev) => ({ ...prev, allowSearch: checked }))}
            />
          </div>
          <ResponsiveDialogFooter className='gap-2'>
            <ResponsiveDialogClose asChild>
              <Button type='button' variant='outline'>
                Cancel
              </Button>
            </ResponsiveDialogClose>
            <Button type='submit' disabled={!form.name.trim() || !!nameError}>
              <Check className='size-4' />
              Create
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
