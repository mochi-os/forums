import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, ArrowRight, FileEdit, Paperclip, Send, X } from 'lucide-react'
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
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const moveAttachment = (index: number, direction: 'left' | 'right') => {
    setAttachments((prev) => {
      const newIndex = direction === 'left' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= prev.length) return prev
      const newArr = [...prev]
      ;[newArr[index], newArr[newIndex]] = [newArr[newIndex], newArr[index]]
      return newArr
    })
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
              {attachments.length > 0 && (
                <>
                  <div className="text-xs font-medium text-muted-foreground">Attachments</div>
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((file, index) => {
                      const isImage = file.type?.startsWith('image/')
                      const previewUrl = isImage ? URL.createObjectURL(file) : undefined
                      const isFirst = index === 0
                      const isLast = index === attachments.length - 1

                      return (
                        <div
                          key={`${file.name}-${file.size}-${file.lastModified}`}
                          className="group/att relative overflow-hidden rounded-[8px] border-2 border-dashed border-primary/30 bg-muted/50 flex items-center justify-center"
                        >
                          {isImage && previewUrl ? (
                            <img
                              src={previewUrl}
                              alt={file.name}
                              className="max-h-[150px] max-w-[200px]"
                            />
                          ) : (
                            <div className="flex h-[100px] w-[150px] flex-col items-center justify-center gap-1 px-2">
                              <Paperclip className="size-6 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground text-center line-clamp-2 break-all">
                                {file.name}
                              </span>
                            </div>
                          )}
                          {/* Hover overlay with controls */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/att:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              type="button"
                              className="size-9 rounded-full bg-white/20 text-white hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                              disabled={isFirst || isPending}
                              onClick={(e) => {
                                e.stopPropagation()
                                moveAttachment(index, 'left')
                              }}
                            >
                              <ArrowLeft className="size-5" />
                            </button>
                            <button
                              type="button"
                              className="size-9 rounded-full bg-white/20 text-white hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                              disabled={isLast || isPending}
                              onClick={(e) => {
                                e.stopPropagation()
                                moveAttachment(index, 'right')
                              }}
                            >
                              <ArrowRight className="size-5" />
                            </button>
                            <button
                              type="button"
                              className="size-9 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center"
                              disabled={isPending}
                              onClick={(e) => {
                                e.stopPropagation()
                                removeAttachment(index)
                              }}
                            >
                              <X className="size-5" />
                            </button>
                          </div>
                          {/* Position indicator */}
                          <div className="absolute top-2 left-2 size-6 rounded-full bg-black/60 text-white text-xs font-medium flex items-center justify-center">
                            {index + 1}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx,.txt,.md"
                className="hidden"
                onChange={handleFileChange}
                disabled={isPending}
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending}
              >
                <Paperclip className="size-4 mr-1" />
                Add files
              </Button>
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
