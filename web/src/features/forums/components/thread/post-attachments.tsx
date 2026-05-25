import { AttachmentGallery, authenticatedUrl, getAppPath, normalizeEntityUrl } from '@mochi/web'
import type { Attachment } from '@/api/types/posts'

interface PostAttachmentsProps {
  attachments: Attachment[]
  forumId: string
  server?: string
  mediaCap?: number
}

export function PostAttachments({ attachments, forumId, server, mediaCap = 8 }: PostAttachmentsProps) {
  const appPath = getAppPath()
  const serverParam = server ? `?server=${encodeURIComponent(server)}` : ''

  return (
    <AttachmentGallery
      attachments={attachments}
      getUrl={(att) =>
        authenticatedUrl(
          normalizeEntityUrl(att.url ?? `${appPath}/${forumId}/-/attachments/${att.id}${serverParam}`)
        )
      }
      getThumbnailUrl={(att) =>
        authenticatedUrl(
          normalizeEntityUrl(
            att.thumbnail_url ?? `${appPath}/${forumId}/-/attachments/${att.id}/thumbnail${serverParam}`
          )
        )
      }
      mediaCap={mediaCap}
    />
  )
}
