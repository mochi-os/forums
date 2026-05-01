import { Button, EmptyState } from '@mochi/web'
import { Trans } from '@lingui/react/macro'
import { FileQuestion } from 'lucide-react'
import { t } from '@lingui/core/macro'

export function EmptyThreadState({ onBack }: { onBack: () => void }) {
  return (
    <div className='flex h-full flex-col items-center justify-center p-8'>
      <EmptyState
        icon={FileQuestion}
        title={t`Post not found`}
        description="This post may have been deleted or doesn't exist."
      >
        <Button onClick={onBack}><Trans>Back to forum</Trans></Button>
      </EmptyState>
    </div>
  )
}
