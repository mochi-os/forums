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
  mergePendingFiles,
  removePendingFile,
  moveItem,
  UploadProgress,
  type Upload,
} from '@mochi/web'
import {
  FileEdit,
  Paperclip,
  Send,
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
  }) => void
  isPending?: boolean
  isSuccess?: boolean
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
    // Copy the FileList before resetting the input: it is live, so clearing
    // the value empties it, and a state updater React defers would then read
    // no files and drop the pick silently.
    const picked = Array.from(event.target.files ?? [])
    // Reset input to allow selecting the same file again
    event.target.value = ''
    if (picked.length > 0) {
      setAttachments((prev) => mergePendingFiles(prev, picked))
    }
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
                  <ComposerAttachments
                    files={attachments}
                    previewUrls={attachmentPreviewUrls}
                    state={isPending ? 'uploading' : 'idle'}
                    progress={progress?.slices}
                    onRemove={(file) =>
                      setAttachments((prev) => removePendingFile(prev, file))
                    }
                    onReorder={(from, to) =>
                      setAttachments((prev) => moveItem(prev, from, to))
                    }
                    groupMedia
                  />
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
