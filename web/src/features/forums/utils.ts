// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import DOMPurify from 'dompurify'

const ALLOWED_IFRAME_HOSTS = [
  'www.youtube.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
]

// Enforce the iframe host allowlist on the PARSED DOM, so an unquoted or oddly
// formatted src can't slip a disallowed iframe past a regex. Registered around
// each sanitize call so it doesn't leak into unrelated DOMPurify usage.
const iframeHostFilter = (node: Node, data: { tagName: string }): void => {
  if (data.tagName !== 'iframe') return
  let host = ''
  try {
    host = new URL((node as Element).getAttribute('src') ?? '').hostname
  } catch {
    host = ''
  }
  if (!ALLOWED_IFRAME_HOSTS.includes(host)) {
    node.parentNode?.removeChild(node)
  }
}

export const sanitizeHtml = (html: string): string => {
  DOMPurify.addHook('uponSanitizeElement', iframeHostFilter)
  try {
    return sanitizeWithConfig(html)
  } finally {
    DOMPurify.removeHook('uponSanitizeElement')
  }
}

const sanitizeWithConfig = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
      'code', 'pre', 'blockquote', 'img', 'figure', 'figcaption',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'iframe', 'div', 'span',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'del', 'sup',
      'sub', 'details', 'summary',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'class', 'src', 'alt', 'title',
      'width', 'height', 'allow', 'allowfullscreen', 'frameborder',
      'style', 'id', 'colspan', 'rowspan',
    ],
    ADD_ATTR: ['target'],
  })
}

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
