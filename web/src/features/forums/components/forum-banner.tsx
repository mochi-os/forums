import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { shellStorage } from '@mochi/web'
import { sanitizeHtml } from '../utils'

interface ForumBannerProps {
  bannerHtml: string
  forumId: string
}

function hashContent(content: string): string {
  let hash = 5381
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash + content.charCodeAt(i)) & 0xffffffff
  }
  return hash.toString(36)
}

export function ForumBanner({ bannerHtml, forumId }: ForumBannerProps) {
  const storageKey = `forums-banner-dismissed-${forumId}`
  const contentHash = hashContent(bannerHtml)
  const [dismissed, setDismissed] = useState<boolean | null>(null)
  const sanitizedBannerHtml = useMemo(() => sanitizeHtml(bannerHtml), [bannerHtml])

  useEffect(() => {
    shellStorage.getItem(storageKey).then((stored) => {
      setDismissed(stored === contentHash)
    })
  }, [storageKey, contentHash])

  if (!bannerHtml || dismissed === null || dismissed) return null

  const handleDismiss = () => {
    shellStorage.setItem(storageKey, contentHash)
    setDismissed(true)
  }

  return (
    <div className="relative mb-4 rounded-lg border bg-muted/50 px-4 py-3">
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-2 top-2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
        aria-label={"Dismiss banner"}
      >
        <X className="size-3.5" />
      </button>
      <div
        className="max-w-none pr-6 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_a:visited]:text-primary/70"
        dangerouslySetInnerHTML={{ __html: sanitizedBannerHtml }}
      />
    </div>
  )
}
