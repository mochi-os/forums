// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { Button, EmptyState } from '@mochi/web'
import { Trans } from '@lingui/react/macro'
import { ChevronLeft, FileQuestion } from 'lucide-react'
import { t } from '@lingui/core/macro'

export function EmptyThreadState({ onBack }: { onBack: () => void }) {
  return (
    <div className='flex h-full flex-col items-center justify-center p-8'>
      <EmptyState
        icon={FileQuestion}
        title={t`Post not found`}
        description={t`This post may have been deleted or doesn't exist.`}
      >
        <Button onClick={onBack}><ChevronLeft className="size-4" /><Trans>Back to forum</Trans></Button>
      </EmptyState>
    </div>
  )
}
