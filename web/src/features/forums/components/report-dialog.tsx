// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useState, type ChangeEvent } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  Button,
  Label,
  RadioGroup,
  RadioGroupItem,
  Textarea,
} from '@mochi/web'
import { Loader2, Send } from 'lucide-react'

function useReportReasons() {
  const { t } = useLingui()
  return [
    { value: 'spam', label: t`Spam` },
    { value: 'harassment', label: t`Harassment` },
    { value: 'hate', label: t`Hate speech` },
    { value: 'violence', label: t`Violence` },
    { value: 'misinformation', label: t`Misinformation` },
    { value: 'offtopic', label: t`Off-topic` },
    { value: 'other', label: t`Other` },
  ]
}

interface ReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (reason: string, details?: string) => void
  isPending?: boolean
  contentType: 'post' | 'comment'
}

export function ReportDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  contentType,
}: ReportDialogProps) {
  const { t } = useLingui()
  const reasons = useReportReasons()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')

  const handleSubmit = () => {
    if (!reason) return
    // Send the value (e.g., "hate") which the backend validates
    onSubmit(reason, details || undefined)
  }

  const handleOpenChange = (newOpen: boolean) => {
    // Reset state when dialog opens or closes
    setReason('')
    setDetails('')
    onOpenChange(newOpen)
  }

  const isValid = reason && (reason !== 'other' || details.trim())

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {contentType === 'post' ? <Trans>Report post</Trans> : <Trans>Report comment</Trans>}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {contentType === 'post' ? (
              <Trans>Select a reason for reporting this post. Reports are reviewed by moderators.</Trans>
            ) : (
              <Trans>Select a reason for reporting this comment. Reports are reviewed by moderators.</Trans>
            )}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className='space-y-4 py-4'>
          <RadioGroup value={reason} onValueChange={setReason}>
            {reasons.map((r) => (
              <div key={r.value} className='flex items-center space-x-2'>
                <RadioGroupItem value={r.value} id={r.value} />
                <Label htmlFor={r.value} className='cursor-pointer'>
                  {r.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div className='space-y-2'>
            <Label htmlFor='details'>
              {reason === 'other' ? <Trans>Details (required)</Trans> : <Trans>Additional details (optional)</Trans>}
            </Label>
            <Textarea
              id='details'
              value={details}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDetails(e.target.value)}
              placeholder={reason === 'other' ? t`Please describe the issue...` : t`Any additional context...`}
              rows={reason === 'other' ? 3 : 2}
            />
          </div>
        </div>

        <ResponsiveDialogFooter>
          <Button variant='outline' onClick={() => handleOpenChange(false)}>
            <Trans>Cancel</Trans>
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isPending}>
            {isPending ? <Loader2 className='size-4 animate-spin' /> : <Send className='size-4' />}
            {isPending ? <Trans>Submitting...</Trans> : <Trans>Submit report</Trans>}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
