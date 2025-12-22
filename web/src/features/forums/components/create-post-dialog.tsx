import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
  Textarea,
  Badge,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@mochi/common'

// Characters disallowed in post titles (matches backend validation for "name" type)
const DISALLOWED_CHARS = /[<>\r\n\\;"'`]/

const createPostSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(1000, 'Title must be 1000 characters or less')
    .refine((val) => !DISALLOWED_CHARS.test(val), {
      message: 'Title cannot contain < > \\ ; " \' or ` characters',
    }),
  body: z.string().min(1, 'Content is required'),
})

type CreatePostFormValues = z.infer<typeof createPostSchema>

type CreatePostDialogProps = {
  forumId: string
  forumName: string
  onCreate: (data: { forum: string; title: string; body: string; attachments?: File[] }) => void
  isPending?: boolean
  isSuccess?: boolean
  triggerVariant?: 'button' | 'icon'
  onSuccess?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}

export function CreatePostDialog({
  forumId,
  forumName,
  onCreate,
  isPending = false,
  isSuccess = false,
  triggerVariant = 'button',
  onSuccess,
  open,
  onOpenChange,
  hideTrigger,
}: CreatePostDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen
  const setIsOpen = onOpenChange ?? setInternalOpen
  const [attachments, setAttachments] = useState<File[]>([])
  const [wasSuccessHandled, setWasSuccessHandled] = useState(false)

  const form = useForm<CreatePostFormValues>({
    resolver: zodResolver(createPostSchema),
    defaultValues: {
      title: '',
      body: '',
    },
  })

  const onSubmit = (values: CreatePostFormValues) => {
    onCreate({
      forum: forumId,
      title: values.title,
      body: values.body,
      attachments: attachments.length > 0 ? attachments : undefined,
    })
  }

  // Close dialog and reset form when post creation succeeds
  useEffect(() => {
    if (isSuccess && isOpen && !wasSuccessHandled) {
      setWasSuccessHandled(true)
      setIsOpen(false)
      form.reset()
      setAttachments([])
      onSuccess?.()
    }
    // Reset the handled flag when isSuccess becomes false (mutation reset)
    if (!isSuccess && wasSuccessHandled) {
      setWasSuccessHandled(false)
    }
  }, [isSuccess, isOpen, wasSuccessHandled, onSuccess, form, setIsOpen])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      setAttachments((prev) => [...prev, ...Array.from(files)])
    }
    // Reset input to allow selecting the same file again
    event.target.value = ''
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      form.reset()
      setAttachments([])
    }
  }

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
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
      )}
      <ResponsiveDialogContent className="sm:max-w-[600px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Create new post</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Share your thoughts, questions, or insights with{' '}
            <span className="font-medium text-foreground">{forumName}</span>
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="What would you like to discuss?"
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-[180px]"
                      placeholder="Share your context, steps you tried, and what kind of help you need..."
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Attachments - handled separately from react-hook-form */}
            <div className="space-y-2">
              <FormLabel>Attachments (optional)</FormLabel>
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
                {attachments.map((file, index) => (
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
              <Button type="submit" disabled={!form.formState.isValid || isPending}>
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
        </Form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}

export { type CreatePostDialogProps }
