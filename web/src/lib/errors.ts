import { ApiError } from '@mochi/common'

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
