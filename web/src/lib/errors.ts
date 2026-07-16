// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { ApiError } from '@mochi/web'

export function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error
  return new Error(fallback)
}

export function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status
  }
  if (error && typeof error === 'object') {
    const maybeError = error as { status?: number; response?: { status?: number } }
    return maybeError.status ?? maybeError.response?.status
  }
  return undefined
}
