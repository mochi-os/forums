// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useState, useEffect, useRef } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
  useImageObjectUrls,
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
  useFormat,
} from '@mochi/web'
import {
  FileEdit,
  Paperclip,
  Send,
  X,
} from 'lucide-react'

// Characters disallowed in post titles (matches backend validation for "name" type)
const DISALLOWED_CHARS = /[<>\r\n]/

function buildSchema(t: (descriptor: TemplateStringsArray) => string) {
  return z.object({
    title: z
      .string()
      .min(1, t`Title is required`)
      .max(1000, t`Title must be 1000 characters or less`)
      .refine((val) => !DISALLOWED_CHARS.test(val), {
        message: t`Title cannot contain < or > characters`,
      }),
    body: z.string().min(1, t`Content is required`),
  })
}

type CreatePostFormValues = z.infer<ReturnType<typeof buildSchema>>

type CreatePostDialogProps = {
  forumId: string
  forumName: string
  onCreate: (data: {
    forum: string
    title: string
    body: string
    attachments?: File[]
  }) => void
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
  forumName: _forumName,
  onCreate,
  isPending = false,
  isSuccess = false,
  triggerVariant = 'button',
  onSuccess,
  open,
  onOpenChange,
  hideTrigger,
}: CreatePostDialogProps) {
  const { t } = useLingui()
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen
  const setIsOpen = onOpenChange ?? setInternalOpen
  const { formatFileSize } = useFormat()
  const [attachments, setAttachments] = useState<File[]>([])
  
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  const canReorder = attachments.length > 1

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (!canReorder) return
    e.dataTransfer.setData('text/plain', index.toString())
    e.dataTransfer.effectAllowed = 'move'
    setDraggingIndex(index)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (!canReorder || draggingIndex === null || draggingIndex === index) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTargetIndex(index)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    if (!canReorder) return
    e.preventDefault()
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain') || draggingIndex?.toString() || '-1')
    if (sourceIndex === -1 || sourceIndex === targetIndex) {
      setDraggingIndex(null)
      setDropTargetIndex(null)
      return
    }
    setAttachments((prev) => {
      const result = [...prev]
      const [removed] = result.splice(sourceIndex, 1)
      result.splice(targetIndex, 0, removed)
      return result
    })
    setDraggingIndex(null)
    setDropTargetIndex(null)
  }

  const handleDragEnd = () => {
    setDraggingIndex(null)
    setDropTargetIndex(null)
  }

  const [wasSuccessHandled, setWasSuccessHandled] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<CreatePostFormValues>({
    resolver: zodResolver(buildSchema(t)),
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

  // Tracks object URLs for image previews and revokes them on change/unmount
  const attachmentPreviewUrls = useImageObjectUrls(attachments)

  return (
    <ResponsiveDialog
      open={isOpen}
      onOpenChange={handleOpenChange}
      shouldCloseOnInteractOutside={false}
    >
      {!hideTrigger && (
        <ResponsiveDialogTrigger asChild>
          {triggerVariant === 'icon' ? (
            <Button variant='outline' size='sm'>
              <FileEdit className='size-4' />
              <Trans>New post</Trans>
            </Button>
          ) : (
            <Button size='sm' className='text-sm'>
              <FileEdit className='size-4' />
              <Trans>New post</Trans>
            </Button>
          )}
        </ResponsiveDialogTrigger>
      )}
      <ResponsiveDialogContent className='sm:max-w-[600px] max-h-[90vh] flex flex-col'>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle><Trans>New post</Trans></ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="sr-only">
            <Trans>Create a new post</Trans>
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <Form {...form}>
          <form className='flex flex-col flex-1 min-h-0' onSubmit={form.handleSubmit(onSubmit)}>
            <div className='space-y-4 overflow-y-auto flex-1 min-h-0'>
            <FormField
              control={form.control}
              name='title'
              render={({ field }) => (
                <FormItem>
                  <FormLabel><Trans>Title</Trans></FormLabel>
                  <FormControl>
                    <Input
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
              name='body'
              render={({ field }) => (
                <FormItem>
                  <FormLabel><Trans>Content</Trans></FormLabel>
                  <FormControl>
                    <Textarea
                      className='min-h-[180px] max-h-[50vh]'
                      placeholder={t`Markdown supported`}
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Attachments - handled separately from react-hook-form */}
            <div className='space-y-2'>
              {attachments.length > 0 && (
                <>
                  <div className='text-muted-foreground text-xs font-medium'>
                    <Trans>Attachments</Trans>
                  </div>
                  <AttachmentGroup
                    onDragOver={(e) => {
                      if (canReorder) e.preventDefault()
                    }}
                  >
                    {attachments.map((file, index) => {
                      const isImage = file.type?.startsWith('image/')
                      const previewUrl = isImage ? attachmentPreviewUrls[index] ?? undefined : undefined
                      const isDragging = draggingIndex === index
                      const isDropTarget = dropTargetIndex === index

                      return (
                        <Attachment
                          key={`${file.name}-${file.size}-${file.lastModified}`}
                          draggable={canReorder}
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragEnd={handleDragEnd}
                          state="uploading"
                          className={`
                            ${canReorder ? 'cursor-grab active:cursor-grabbing' : ''}
                            ${isDragging ? 'opacity-40' : ''}
                            ${isDropTarget ? 'ring-primary rounded-lg ring-2 ring-inset' : ''}
                          `}
                        >
                          <AttachmentMedia variant={isImage ? "image" : "icon"}>
                            {isImage && previewUrl ? (
                              <img src={previewUrl} alt={file.name} draggable={false} />
                            ) : (
                              <Paperclip />
                            )}
                          </AttachmentMedia>
                          <AttachmentContent>
                            <AttachmentTitle>{file.name}</AttachmentTitle>
                            <AttachmentDescription>{formatFileSize(file.size)}</AttachmentDescription>
                          </AttachmentContent>
                          <AttachmentActions>
                            <AttachmentAction
                              onClick={(e) => {
                                e.stopPropagation()
                                removeAttachment(index)
                              }}
                              aria-label={t`Remove`}
                            >
                              <X className='size-4' />
                            </AttachmentAction>
                          </AttachmentActions>
                        </Attachment>
                      )
                    })}
                  </AttachmentGroup>
                </>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type='file'
                multiple
                accept='image/*,video/*,.pdf,.doc,.docx,.txt,.md'
                className='hidden'
                onChange={handleFileChange}
                disabled={isPending}
              />

              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending}
              >
                <Paperclip className='me-1 size-4' />
                <Trans>Add files</Trans>
              </Button>
            </div>

            </div>
            <ResponsiveDialogFooter className='gap-2 pt-4'>
              <ResponsiveDialogClose asChild>
                <Button type='button' variant='outline' disabled={isPending}>
                  <Trans>Cancel</Trans>
                </Button>
              </ResponsiveDialogClose>
              <Button
                type='submit'
                disabled={!form.formState.isValid || isPending}
              >
                {isPending ? (
                  <>
                    <Send className='size-4' />
                    <Trans>Publishing...</Trans>
                  </>
                ) : (
                  <>
                    <Send className='size-4' />
                    <Trans>Publish post</Trans>
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
