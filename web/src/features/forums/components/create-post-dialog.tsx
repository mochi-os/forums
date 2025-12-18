import { useState, useMemo } from 'react'
import { FileEdit, Send, Upload, X } from 'lucide-react'
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
  Textarea,
  Badge,
} from '@mochi/common'

// Characters disallowed in post titles (matches backend validation for "name" type)
const DISALLOWED_CHARS = /[<>\r\n\\;"'`]/

function validateTitle(title: string): string | null {
  if (!title.trim()) {
    return null // Empty is handled separately
  }
  if (DISALLOWED_CHARS.test(title)) {
    return 'Title cannot contain < > \\ ; " \' or ` characters'
  }
  if (title.length > 1000) {
    return 'Title must be 1000 characters or less'
  }
  return null
}

type CreatePostDialogProps = {
  forumId: string
  forumName: string
  onCreate: (data: { forum: string; title: string; body: string; attachments?: File[] }) => void
  isPending?: boolean
  triggerVariant?: 'button' | 'icon'
}

type CreatePostFormState = {
  title: string
  body: string
  attachments: File[]
}

export function CreatePostDialog({
  forumId,
  forumName,
  onCreate,
  isPending = false,
  triggerVariant = 'button',
}: CreatePostDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState<CreatePostFormState>({
    title: '',
    body: '',
    attachments: [],
  })

  const titleError = useMemo(() => validateTitle(form.title), [form.title])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.title.trim() || !form.body.trim() || titleError) return

    onCreate({
      forum: forumId,
      title: form.title,
      body: form.body,
      attachments: form.attachments.length > 0 ? form.attachments : undefined,
    })
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      setForm((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...Array.from(files)],
      }))
    }
    // Reset input to allow selecting the same file again
    event.target.value = ''
  }

  const removeAttachment = (index: number) => {
    setForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }))
  }

  const resetForm = () => {
    setForm({
      title: '',
      body: '',
      attachments: [],
    })
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      resetForm()
    }
  }

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={handleOpenChange}>
      <ResponsiveDialogTrigger asChild>
        {triggerVariant === 'icon' ? (
          <Button variant="outline" size="sm">
            <FileEdit className="size-4" />
            New post
          </Button>
        ) : (
          <Button size="sm" className="text-sm">
            <FileEdit className="size-4" />
            New post
          </Button>
        )}
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-[600px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Create New Post</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Share your thoughts, questions, or insights with{' '}
            <span className="font-medium text-foreground">{forumName}</span>
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="post-title">Title</Label>
            <Input
              id="post-title"
              placeholder="What would you like to discuss?"
              value={form.title}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, title: event.target.value }))
              }
              aria-invalid={!!titleError}
              disabled={isPending}
            />
            {titleError && (
              <p className="text-sm text-destructive">{titleError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="post-body">Content</Label>
            <Textarea
              id="post-body"
              className="min-h-[180px]"
              placeholder="Share your context, steps you tried, and what kind of help you need..."
              value={form.body}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                setForm((prev) => ({ ...prev, body: event.target.value }))
              }
              disabled={isPending}
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <Label>Attachments (optional)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="post-attachments"
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-accent hover:text-foreground"
              >
                <Upload className="size-4" />
                Add files
                <input
                  id="post-attachments"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isPending}
                />
              </label>
              {form.attachments.map((file, index) => (
                <Badge
                  key={`${file.name}-${index}`}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  <span className="max-w-[120px] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="rounded-full p-0.5 hover:bg-destructive/20"
                    disabled={isPending}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <ResponsiveDialogFooter className="gap-2">
            <ResponsiveDialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </ResponsiveDialogClose>
            <Button
              type="submit"
              disabled={!form.title.trim() || !form.body.trim() || !!titleError || isPending}
            >
              {isPending ? (
                <>
                  <Send className="size-4" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Publish post
                </>
              )}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

// Export for parent component to call after successful mutation
export { type CreatePostDialogProps }
