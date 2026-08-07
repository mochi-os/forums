// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useState, useEffect, useRef, useMemo } from 'react'
import { Trans } from '@lingui/react/macro'
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
  AttachmentComposer,
  type ComposerItem,
  moveItem,
  useImageObjectUrls,
  UploadProgress,
  type Upload,
} from '@mochi/web'
import { Save, Paperclip } from 'lucide-react'
import type { Post, Attachment as AttachmentData } from '@/api/types/posts'
import {
  buildForumPostEditDraft,
  forumPostEditOriginalFromPost,
  isForumPostEditUnchanged,
} from '@/features/forums/edit-compare'
import { usePostSchema, type PostFormValues } from '@/features/forums/post-schema'

type EditPostFormValues = PostFormValues

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
  /** Byte progress of the save upload, when the caller tracks it */
  progress?: Upload | null
}

export function EditPostDialog({
  post,
  open,
  onOpenChange,
  onSave,
  isPending = false,
  progress,
}: EditPostDialogProps) {
  const appPath = getAppPath()
  const [items, setItems] = useState<EditingAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const postSchema = usePostSchema()

  const form = useForm<EditPostFormValues>({
    resolver: zodResolver(postSchema),
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

  const newFiles = useMemo(
    () => items.flatMap((it) => (it.kind === 'new' ? [it.file] : [])),
    [items]
  )
  const newFileUrls = useImageObjectUrls(newFiles)
  const urlByNewFile = useMemo(() => {
    const m = new Map<File, string | null>()
    newFiles.forEach((f, i) => m.set(f, newFileUrls[i]))
    return m
  }, [newFiles, newFileUrls])

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

  // The edit list mixes attachments already on the post with files not yet
  // uploaded, so it maps onto ComposerItem by hand rather than going through
  // the File[] wrapper.
  const attachmentItems = useMemo<ComposerItem[]>(
    () =>
      items.map((item) => {
        if (item.kind === 'existing') {
          const att = item.attachment
          return {
            key: att.id,
            name: att.name,
            size: att.size,
            type: att.type ?? '',
            previewUrl: att.type?.startsWith('image/')
              ? authenticatedUrl(
                  `${appPath}/${post.forum}/-/attachments/${att.id}/thumbnail`
                )
              : null,
          }
        }
        const { file } = item
        return {
          key: `new-${file.name}-${file.size}-${file.lastModified}`,
          name: file.name,
          size: file.size,
          type: file.type,
          previewUrl: file.type?.startsWith('image/')
            ? (urlByNewFile.get(file) ?? null)
            : null,
          badge: (
            <span className='bg-primary/85 text-primary-foreground rounded px-1.5 py-0.5 text-[10px] font-bold uppercase'>
              <Trans>New</Trans>
            </span>
          ),
          // Saved attachments are referenced by `order` rather than uploaded,
          // so a slice is addressed by the file's rank in `newFiles` — the
          // array that becomes the body — not by its slot in this mixed list.
          progress: progress?.slices?.[newFiles.indexOf(file)],
        }
      }),
    [items, appPath, post.forum, urlByNewFile, newFiles, progress]
  )

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
                <AttachmentComposer
                  items={attachmentItems}
                  layout='grid'
                  preview='tile'
                  state={isPending ? 'uploading' : 'idle'}
                  onRemove={removeItem}
                  onReorder={(from, to) =>
                    setItems((prev) => moveItem(prev, from, to))
                  }
                />
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
            <UploadProgress progress={progress ?? null} className='pt-2' />
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
