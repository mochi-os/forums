/**
 * Convert standalone YouTube/Vimeo links in HTML to responsive iframe embeds.
 * Only replaces <a> tags that are the sole content of their <p> tag.
 */
export const embedVideos = (html: string): string => {
  return html.replace(
    /<p>\s*<a[^>]+href="(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|vimeo\.com\/)([^"&\s]+)[^"]*)"[^>]*>[^<]*<\/a>\s*<\/p>/gi,
    (_match, url: string, id: string) => {
      let embedUrl: string | null = null

      if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
        const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
        if (ytMatch) {
          embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`
        }
      } else if (url.includes('vimeo.com/')) {
        embedUrl = `https://player.vimeo.com/video/${id}`
      }

      if (!embedUrl) return _match

      return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;border-radius:8px"><iframe src="${embedUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
    }
  )
}
