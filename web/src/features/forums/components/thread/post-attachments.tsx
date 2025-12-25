import { useState } from 'react'
import {
  ImageLightbox,
  type LightboxMedia,
  useVideoThumbnailCached,
  formatVideoDuration,
  formatFileSize,
  getFileIcon,
  isImage,
  isVideo,
} from '@mochi/common'
import { Loader2, Play } from 'lucide-react'
import type { Attachment } from '@/api/types/posts'

interface PostAttachmentsProps {
  attachments: Attachment[]
  forumId: string
  server?: string
}

// Component to render video thumbnail using the hook
function VideoThumbnail({ url }: { url: string }) {
  const {
    url: thumbnailUrl,
    loading,
    error,
    duration,
  } = useVideoThumbnailCached(url)

  if (loading) {
    return (
      <div className='bg-muted flex h-[150px] w-[200px] items-center justify-center'>
        <Loader2 className='text-muted-foreground size-8 animate-spin' />
      </div>
    )
  }

  if (error || !thumbnailUrl) {
    return (
      <div className='bg-muted flex h-[150px] w-[200px] items-center justify-center'>
        <Play className='text-muted-foreground size-12' />
      </div>
    )
  }

  return (
    <div className='relative'>
      <img
        src={thumbnailUrl}
        alt='Video thumbnail'
        className='h-[150px] w-auto object-cover transition-transform group-hover/thumb:scale-105'
      />
      <div className='absolute inset-0 flex items-center justify-center'>
        <div className='rounded-full bg-black/50 p-3'>
          <Play className='size-8 text-white' />
        </div>
      </div>
      {duration != null && (
        <div className='absolute right-1 bottom-1 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white'>
          {formatVideoDuration(duration)}
        </div>
      )}
    </div>
  )
}

export function PostAttachments({
  attachments,
  forumId,
  server,
}: PostAttachmentsProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  if (!attachments || attachments.length === 0) {
    return null
  }

  const appBase = import.meta.env.VITE_APP_BASE_URL || '/forums'
  const serverParam = server ? `?server=${encodeURIComponent(server)}` : ''

  // Unified attachment URL - backend handles local vs remote
  const getAttachmentUrl = (id: string) => {
    return `${appBase}/${forumId}/-/attachments/${id}${serverParam}`
  }

  // Thumbnail URL for images
  const getThumbnailUrl = (id: string) => {
    return `${appBase}/${forumId}/-/attachments/${id}/thumbnail${serverParam}`
  }

  // Separate media (images + videos) from other files
  const media = attachments.filter(
    (att) => isImage(att.type) || isVideo(att.type)
  )
  const files = attachments.filter(
    (att) => !isImage(att.type) && !isVideo(att.type)
  )

  // Build lightbox media array
  const lightboxMedia: LightboxMedia[] = media.map((att) => ({
    id: att.id,
    name: att.name,
    url: getAttachmentUrl(att.id),
    type: isVideo(att.type) ? 'video' : 'image',
  }))

  const openLightbox = (index: number) => {
    setCurrentIndex(index)
    setLightboxOpen(true)
  }

  // Media buttons
  const mediaButtons = media.map((attachment, index) => (
    <button
      key={attachment.id}
      type='button'
      onClick={(e) => {
        e.stopPropagation()
        openLightbox(index)
      }}
      className='group/thumb relative overflow-hidden rounded-[8px] border'
    >
      {isVideo(attachment.type) ? (
        <VideoThumbnail url={getAttachmentUrl(attachment.id)} />
      ) : (
        <img
          src={getThumbnailUrl(attachment.id)}
          alt={attachment.name}
          className='block max-h-[250px] transition-transform group-hover/thumb:scale-105'
        />
      )}
    </button>
  ))

  // File links
  const fileLinks = files.map((attachment) => {
    const FileIcon = getFileIcon(attachment.type)
    return (
      <a
        key={attachment.id}
        href={getAttachmentUrl(attachment.id)}
        onClick={(e) => e.stopPropagation()}
        className='hover:bg-muted flex items-center gap-2 rounded-[8px] border p-2 text-sm transition-colors'
      >
        <FileIcon className='text-muted-foreground size-4 shrink-0' />
        <span className='min-w-0 flex-1 truncate'>{attachment.name}</span>
        <span className='text-muted-foreground shrink-0 text-xs'>
          {formatFileSize(attachment.size)}
        </span>
      </a>
    )
  })

  // Lightbox
  const lightbox = (
    <ImageLightbox
      images={lightboxMedia}
      currentIndex={currentIndex}
      open={lightboxOpen}
      onOpenChange={setLightboxOpen}
      onIndexChange={setCurrentIndex}
    />
  )

  return (
    <div className='space-y-3'>
      {media.length > 0 && (
        <div className='flex flex-wrap items-start gap-2'>{mediaButtons}</div>
      )}
      {files.length > 0 && <div className='space-y-1'>{fileLinks}</div>}
      {lightbox}
    </div>
  )
}
