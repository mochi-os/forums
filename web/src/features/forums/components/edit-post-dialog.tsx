// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useState, useEffect, useRef, useMemo } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
  getAppPath,
  authenticatedUrl,
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
import { Save, Paperclip, X } from 'lucide-react'
import type { Post, Attachment as AttachmentData } from '@/api/types/posts'
import {
  buildForumPostEditDraft,
  forumPostEditOriginalFromPost,
  isForumPostEditUnchanged,
} from '@/features/forums/edit-compare'

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

type EditPostFormValues = z.infer<ReturnType<typeof buildSchema>>

// Unified attachment type for editing - can be existing or new
type EditingAttachment =
  | { kind: 'existing'; attachment: AttachmentData }
  | { kind: 'new'; file: File }

type EditPostDialogProps = {
  post: Post
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: {
    title: string
    body: string
    order: string[]
    attachments: File[]
  }) => void
  isPending?: boolean
}

export function EditPostDialog({
  post,
  open,
  onOpenChange,
  onSave,
  isPending = false,
}: EditPostDialogProps) {
  const { t } = useLingui()
  const appPath = getAppPath()
  const [items, setItems] = useState<EditingAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<EditPostFormValues>({
    resolver: zodResolver(buildSchema(t)),
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
      const existingItems: EditingAttachment[] = (post.attachments || []).map(
        (att) => ({
          kind: 'existing' as const,
          attachment: att,
        })
      )
      setItems(existingItems)
    }
  }, [open, post, form])

  const watchedTitle = form.watch('title')
  const watchedBody = form.watch('body')
  const hasChanges = useMemo(() => {
    const draft = buildForumPostEditDraft(items, {
      title: watchedTitle,
      body: watchedBody,
    })
    const original = forumPostEditOriginalFromPost(post)
    return !isForumPostEditUnchanged(original, draft)
  }, [items, watchedTitle, watchedBody, post])

  const onSubmit = (values: EditPostFormValues) => {
    const draft = buildForumPostEditDraft(items, values)
    const original = forumPostEditOriginalFromPost(post)
    if (isForumPostEditUnchanged(original, draft)) {
      onOpenChange(false)
      return
    }

    onSave({
      title: draft.title,
      body: draft.body,
      order: draft.order ?? [],
      attachments: draft.attachments ?? [],
    })
  }

  const { formatFileSize } = useFormat()
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  const canReorder = items.length > 1

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
    setItems((prev) => {
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



  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      shouldCloseOnInteractOutside={false}
    >
      <ResponsiveDialogContent className='sm:max-w-[600px] max-h-[90vh] flex flex-col'>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle><Trans>Edit post</Trans></ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="sr-only">
            <Trans>Edit post</Trans>
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
              <div className='space-y-2'>
                <div className='text-sm font-medium'><Trans>Attachments</Trans></div>
                  <AttachmentGroup
                    onDragOver={(e) => {
                      if (canReorder) e.preventDefault()
                    }}
                  >
                    {items.map((item, index) => {
                      const isExisting = item.kind === 'existing'
                      const isImage = isExisting
                        ? item.attachment.type?.startsWith('image/')
                        : item.file.type?.startsWith('image/')
                      const thumbnailUrl =
                        isExisting && isImage
                          ? authenticatedUrl(`${appPath}/${post.forum}/-/attachments/${item.attachment.id}/thumbnail`)
                          : undefined
                      const previewUrl =
                        !isExisting && isImage
                          ? URL.createObjectURL(item.file)
                          : undefined
                      const itemKey = isExisting
                        ? item.attachment.id
                        : `new-${item.file.name}-${item.file.size}-${item.file.lastModified}`
                      const isDragging = draggingIndex === index
                      const isDropTarget = dropTargetIndex === index

                      return (
                        <Attachment
                          key={itemKey}
                          draggable={canReorder}
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragEnd={handleDragEnd}
                          state={isExisting ? "done" : "uploading"}
                          className={`
                            ${canReorder ? 'cursor-grab active:cursor-grabbing' : ''}
                            ${isDragging ? 'opacity-40' : ''}
                            ${isDropTarget ? 'ring-primary rounded-lg ring-2 ring-inset' : ''}
                          `}
                        >
                          <AttachmentMedia variant={isImage ? "image" : "icon"}>
                            {isImage && (thumbnailUrl || previewUrl) ? (
                              <img src={thumbnailUrl || previewUrl} alt={isExisting ? item.attachment.name : item.file.name} draggable={false} />
                            ) : (
                              <Paperclip />
                            )}
                          </AttachmentMedia>
                          <AttachmentContent>
                            <AttachmentTitle>
                              {isExisting ? item.attachment.name : item.file.name}
                            </AttachmentTitle>
                            <AttachmentDescription>
                              {isExisting ? formatFileSize(item.attachment.size) : formatFileSize(item.file.size)}
                              {!isExisting && <span className="ml-2 px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[10px] uppercase font-bold"><Trans>New</Trans></span>}
                            </AttachmentDescription>
                          </AttachmentContent>
                          <AttachmentActions>
                            <AttachmentAction onClick={(e) => { e.stopPropagation(); removeItem(index); }} aria-label={t`Remove`}>
                              <X className='size-4' />
                            </AttachmentAction>
                          </AttachmentActions>
                        </Attachment>
                      )
                    })}
                  </AttachmentGroup>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type='file'
              multiple
              className='hidden'
              onChange={handleFileChange}
              disabled={isPending}
            />

            </div>
            <ResponsiveDialogFooter className='gap-2 pt-4'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending}
              >
                <Paperclip className='size-4' />
                <Trans>Add files</Trans>
              </Button>
              <div className='flex-1' />
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                <Trans>Cancel</Trans>
              </Button>
              <Button
                type='submit'
                disabled={!form.formState.isValid || isPending || !hasChanges}
              >
                {isPending ? (
                  <>
                    <Save className='size-4' />
                    <Trans>Saving...</Trans>
                  </>
                ) : (
                  <>
                    <Save className='size-4' />
                    <Trans>Save changes</Trans>
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
