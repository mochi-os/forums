// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useState, useEffect, useRef } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
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
  ComposerAttachments,
  AttachmentAddTile,
  cn,
  dropActiveClass,
  useComposerDrop,
  mergePendingFiles,
  removePendingFile,
  moveItem,
  pendingFileKey,
  UploadProgress,
  type Upload,
} from '@mochi/web'
import {
  FileEdit,
  Send,
  Loader2,
} from 'lucide-react'
import { usePostSchema, type PostFormValues } from '@/features/forums/post-schema'

type CreatePostFormValues = PostFormValues

type CreatePostDialogProps = {
  forumId: string
  forumName: string
  onCreate: (data: {
    forum: string
    title: string
    body: string
    attachments?: File[]
    captions?: string[]
  }) => void
  isPending?: boolean
  isSuccess?: boolean
  /** The create failed; the composer says so and offers the draft back. */
  isError?: boolean
  /** Byte progress of the submit upload, when the caller tracks it */
  progress?: Upload | null
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
  isError = false,
  progress,
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
  const [attachments, setAttachments] = useState<File[]>([])
  // Keyed by pendingFileKey so a reorder or removal never re-attaches a
  // caption to the wrong file.
  const [captions, setCaptions] = useState<Record<string, string>>({})

  const [wasSuccessHandled, setWasSuccessHandled] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const postSchema = usePostSchema()

  const form = useForm<CreatePostFormValues>({
    resolver: zodResolver(postSchema),
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
      captions:
        attachments.length > 0
          ? attachments.map((file) => captions[pendingFileKey(file)] ?? '')
          : undefined,
    })
  }

  // Close dialog and reset form when post creation succeeds
  useEffect(() => {
    if (isSuccess && isOpen && !wasSuccessHandled) {
      setWasSuccessHandled(true)
      setIsOpen(false)
      form.reset()
      setAttachments([])
      setCaptions({})
      onSuccess?.()
    }
    // Reset the handled flag when isSuccess becomes false (mutation reset)
    if (!isSuccess && wasSuccessHandled) {
      setWasSuccessHandled(false)
    }
  }, [isSuccess, isOpen, wasSuccessHandled, onSuccess, form, setIsOpen])

  // One staging path for the picker and for a drop, so the two cannot come to
  // disagree about what counts as a file already staged.
  const addFiles = (picked: File[]) => {
    if (picked.length === 0) return
    setAttachments((prev) => mergePendingFiles(prev, picked))
  }

  // Claims the drop for the whole dialog. Without this the browser takes it,
  // navigates to the dropped file, and the draft goes with it.
  const { isDragActive, dropzoneProps } = useComposerDrop({
    onFiles: addFiles,
    disabled: isPending,
  })

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Copy the FileList before resetting the input: it is live, so clearing
    // the value empties it, and a state updater React defers would then read
    // no files and drop the pick silently.
    const picked = Array.from(event.target.files ?? [])
    // Reset input to allow selecting the same file again
    event.target.value = ''
    addFiles(picked)
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      form.reset()
      setAttachments([])
      setCaptions({})
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
      <ResponsiveDialogContent className='sm:max-w-[720px] max-h-[90vh] flex flex-col'>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle><Trans>New post</Trans></ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="sr-only">
            <Trans>Create a new post</Trans>
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <Form {...form}>
          <form className='flex flex-col flex-1 min-h-0' onSubmit={form.handleSubmit(onSubmit)} {...dropzoneProps}>
            <div className={cn('space-y-4 overflow-y-auto flex-1 min-h-0', isDragActive && dropActiveClass)}>
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

            {/* Attachments - handled separately from react-hook-form. Same
                shape as the edit dialog: labelled blocks, and the add tile as
                the last cell of the grid rather than a button under it. */}
            <div className='space-y-2'>
              <ComposerAttachments
                files={attachments}
                previewUrls={attachmentPreviewUrls}
                state={isPending ? 'uploading' : isError ? 'error' : 'idle'}
                onRetry={form.handleSubmit(onSubmit)}
                progress={progress?.slices}
                onRemove={(file) =>
                  setAttachments((prev) => removePendingFile(prev, file))
                }
                onReorder={(from, to) =>
                  setAttachments((prev) => moveItem(prev, from, to))
                }
                captions={captions}
                onCaption={(file, caption) =>
                  setCaptions((prev) => {
                    const next = { ...prev }
                    if (caption) next[pendingFileKey(file)] = caption
                    else delete next[pendingFileKey(file)]
                    return next
                  })
                }
                groupMedia
                blockLabels={{
                  media: <Trans>Photos and videos</Trans>,
                  files: <Trans>Files</Trans>,
                }}
                addSlot={
                  <AttachmentAddTile
                    label={<Trans>Add files</Trans>}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isPending}
                  />
                }
              />

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
            </div>

            </div>
            <UploadProgress progress={progress ?? null} className='pt-2' />
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
                    <Loader2 className='size-4 animate-spin' />
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

