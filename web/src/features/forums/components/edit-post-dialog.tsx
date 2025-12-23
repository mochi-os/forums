import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save, ArrowLeft, ArrowRight, Paperclip, X } from 'lucide-react'
import {
  Button,
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  Input,
  Textarea,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@mochi/common'
import type { Post, Attachment } from '@/api/types/posts'

// Characters disallowed in post titles (matches backend validation for "name" type)
const DISALLOWED_CHARS = /[<>\r\n\\;"'`]/

const editPostSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(1000, 'Title must be 1000 characters or less')
    .refine((val) => !DISALLOWED_CHARS.test(val), {
      message: 'Title cannot contain < > \\ ; " \' or ` characters',
    }),
  body: z.string().min(1, 'Content is required'),
})

type EditPostFormValues = z.infer<typeof editPostSchema>

// Unified attachment type for editing - can be existing or new
type EditingAttachment =
  | { kind: 'existing'; attachment: Attachment }
  | { kind: 'new'; file: File }

type EditPostDialogProps = {
  post: Post
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: { title: string; body: string; order: string[]; attachments: File[] }) => void
  isPending?: boolean
}

export function EditPostDialog({
  post,
  open,
  onOpenChange,
  onSave,
  isPending = false,
}: EditPostDialogProps) {
  const appBase = import.meta.env.VITE_APP_BASE_URL || '/forums'
  const [items, setItems] = useState<EditingAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<EditPostFormValues>({
    resolver: zodResolver(editPostSchema),
    defaultValues: {
      title: post.title,
      body: post.body,
    },
  })

  // Reset form when dialog opens/closes or post changes
  useEffect(() => {
    if (open) {
      form.reset({
        title: post.title,
        body: post.body,
      })
      // Initialize attachment items from existing attachments
      const existingItems: EditingAttachment[] = (post.attachments || []).map((att) => ({
        kind: 'existing' as const,
        attachment: att,
      }))
      setItems(existingItems)
    }
  }, [open, post, form])

  const onSubmit = (values: EditPostFormValues) => {
    // Build order array: existing IDs and "new:N" placeholders
    const order: string[] = []
    const newFiles: File[] = []
    let newIndex = 0
    for (const item of items) {
      if (item.kind === 'existing') {
        order.push(item.attachment.id)
      } else {
        order.push(`new:${newIndex}`)
        newFiles.push(item.file)
        newIndex++
      }
    }

    onSave({
      title: values.title,
      body: values.body,
      order,
      attachments: newFiles,
    })
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      const newItems: EditingAttachment[] = Array.from(files).map((file) => ({
        kind: 'new' as const,
        file,
      }))
      setItems((prev) => [...prev, ...newItems])
    }
    event.target.value = ''
  }

  const moveItem = (index: number, direction: 'left' | 'right') => {
    setItems((prev) => {
      const newIndex = direction === 'left' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= prev.length) return prev
      const newItems = [...prev]
      ;[newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]]
      return newItems
    })
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[600px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Edit post</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Make changes to your post
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
                      placeholder="Share your thoughts..."
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Attachments grid */}
            {items.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Attachments</div>
                <div className="flex flex-wrap gap-2">
                  {items.map((item, index, arr) => {
                    const isExisting = item.kind === 'existing'
                    const isImage = isExisting
                      ? item.attachment.type?.startsWith('image/')
                      : item.file.type?.startsWith('image/')
                    const thumbnailUrl = isExisting && isImage
                      ? `${appBase}/${post.forum}/-/attachments/${item.attachment.id}/thumbnail`
                      : undefined
                    const previewUrl = !isExisting && isImage
                      ? URL.createObjectURL(item.file)
                      : undefined
                    const itemKey = isExisting
                      ? item.attachment.id
                      : `new-${item.file.name}-${item.file.size}-${item.file.lastModified}`
                    const isFirst = index === 0
                    const isLast = index === arr.length - 1

                    return (
                      <div
                        key={itemKey}
                        className={`group/att relative overflow-hidden rounded-lg flex items-center justify-center ${
                          isExisting ? 'border bg-muted' : 'border-2 border-dashed border-primary/30 bg-muted/50'
                        }`}
                      >
                        {isImage && (thumbnailUrl || previewUrl) ? (
                          <img
                            src={thumbnailUrl || previewUrl}
                            alt={isExisting ? item.attachment.name : item.file.name}
                            className="max-h-[120px] max-w-[160px] object-cover"
                          />
                        ) : (
                          <div className="flex h-[80px] w-[120px] flex-col items-center justify-center gap-1 px-2">
                            <Paperclip className="size-5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground text-center line-clamp-2 break-all">
                              {isExisting ? item.attachment.name : item.file.name}
                            </span>
                          </div>
                        )}
                        {/* Hover overlay with controls */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/att:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          <button
                            type="button"
                            className="size-7 rounded-full bg-white/20 text-white hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                            disabled={isFirst || isPending}
                            onClick={() => moveItem(index, 'left')}
                          >
                            <ArrowLeft className="size-4" />
                          </button>
                          <button
                            type="button"
                            className="size-7 rounded-full bg-white/20 text-white hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                            disabled={isLast || isPending}
                            onClick={() => moveItem(index, 'right')}
                          >
                            <ArrowRight className="size-4" />
                          </button>
                          <button
                            type="button"
                            className="size-7 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center"
                            disabled={isPending}
                            onClick={() => removeItem(index)}
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                        {/* Position indicator or New badge */}
                        <div className={`absolute top-1 left-1 ${
                          isExisting
                            ? 'size-5 rounded-full bg-black/60 text-white text-xs font-medium flex items-center justify-center'
                            : 'px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-medium'
                        }`}>
                          {isExisting ? index + 1 : 'New'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={isPending}
            />

            <ResponsiveDialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending}
              >
                <Paperclip className="size-4" />
                Add files
              </Button>
              <div className="flex-1" />
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!form.formState.isValid || isPending}>
                {isPending ? (
                  <>
                    <Save className="size-4" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    Save changes
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
