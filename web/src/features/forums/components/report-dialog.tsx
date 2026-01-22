import { useState } from 'react'
import type { ChangeEvent } from 'react'
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
} from '@mochi/common'

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'violence', label: 'Violence' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'offtopic', label: 'Off-topic' },
  { value: 'other', label: 'Other' },
]

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
          <ResponsiveDialogTitle>Report {contentType}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Select a reason for reporting this {contentType}. Reports are reviewed by moderators.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className='space-y-4 py-4'>
          <RadioGroup value={reason} onValueChange={setReason}>
            {REPORT_REASONS.map((r) => (
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
              {reason === 'other' ? 'Details (required)' : 'Additional details (optional)'}
            </Label>
            <Textarea
              id='details'
              value={details}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDetails(e.target.value)}
              placeholder={reason === 'other' ? 'Please describe the issue...' : 'Any additional context...'}
              rows={reason === 'other' ? 3 : 2}
            />
          </div>
        </div>

        <ResponsiveDialogFooter>
          <Button variant='outline' onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isPending}>
            {isPending ? 'Submitting...' : 'Submit report'}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
