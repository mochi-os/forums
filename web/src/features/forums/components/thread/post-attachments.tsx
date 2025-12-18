import { useState } from 'react'
import {
  cn,
  Dialog,
  DialogContent,
  DialogTitle,
} from '@mochi/common'
import { Download, FileIcon, ZoomIn } from 'lucide-react'
import type { Attachment } from '@/api/types/posts'

interface PostAttachmentsProps {
  attachments: Attachment[]
}

// Format file size for display
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function PostAttachments({ attachments }: PostAttachmentsProps) {
  const [selectedImage, setSelectedImage] = useState<Attachment | null>(null)

  if (!attachments || attachments.length === 0) {
    return null
  }

  const imageAttachments = attachments.filter((a) => a.image)
  const fileAttachments = attachments.filter((a) => !a.image)

  return (
    <div className="mt-4 space-y-3">
      {/* Image Grid - larger previews using full URL */}
      {imageAttachments.length > 0 && (
        <div
          className={cn(
            'grid gap-3',
            imageAttachments.length === 1 && 'grid-cols-1',
            imageAttachments.length >= 2 && 'grid-cols-2'
          )}
        >
          {imageAttachments.map((attachment) => (
            <button
              key={attachment.id}
              type="button"
              onClick={() => setSelectedImage(attachment)}
              className={cn(
                'group relative overflow-hidden rounded-lg',
                'border border-border bg-muted/30',
                'transition-all hover:border-foreground/30 hover:shadow-md',
                'focus:outline-none focus:ring-2 focus:ring-ring',
                // Larger height for better preview
                imageAttachments.length === 1 ? 'max-w-2xl h-80' : 'h-48'
              )}
            >
              {/* Use full URL for better quality preview */}
              <img
                src={attachment.url}
                alt={attachment.name}
                className="h-full w-full object-cover transition-transform group-hover:scale-102"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
                <ZoomIn className="size-8 text-white opacity-0 drop-shadow-lg transition-opacity group-hover:opacity-100" />
              </div>
              {/* Image name overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="text-sm text-white truncate block">{attachment.name}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* File Attachments */}
      {fileAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fileAttachments.map((attachment) => (
            <a
              key={attachment.id}
              href={attachment.url}
              download={attachment.name}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2',
                'border border-border bg-muted/30',
                'text-sm text-muted-foreground',
                'transition-colors hover:border-foreground/30 hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <FileIcon className="size-4" />
              <span className="max-w-36 truncate">{attachment.name}</span>
              <span className="text-xs opacity-70">
                ({formatFileSize(attachment.size)})
              </span>
              <Download className="size-3.5" />
            </a>
          ))}
        </div>
      )}

      {/* Image Lightbox - full size preview */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">
            {selectedImage?.name || 'Image preview'}
          </DialogTitle>
          {selectedImage && (
            <div className="flex flex-col">
              {/* Large image */}
              <div className="flex items-center justify-center bg-muted/50 p-4">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.name}
                  className="max-h-[75vh] w-auto object-contain rounded"
                />
              </div>
              {/* Footer with name and download */}
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <span className="text-sm font-medium truncate">{selectedImage.name}</span>
                <a
                  href={selectedImage.url}
                  download={selectedImage.name}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Download className="size-4" />
                  Download
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
