// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useMemo } from 'react'
import { useLingui } from '@lingui/react/macro'
import { z } from 'zod'

// Characters disallowed in post titles (matches backend validation for "name" type)
const DISALLOWED_CHARS = /[<>\r\n]/

/**
 * Post form validation, built in a hook: the lingui macro only rewrites a `t`
 * destructured from useLingui in the same scope, so a `t` passed as an argument
 * never reaches the catalogs and resolves to an empty string.
 */
export function usePostSchema() {
  const { t } = useLingui()
  return useMemo(
    () =>
      z.object({
        title: z
          .string()
          .min(1, t`Title is required`)
          .max(1000, t`Title must be 1000 characters or less`)
          .refine((val) => !DISALLOWED_CHARS.test(val), {
            message: t`Title cannot contain < or > characters`,
          }),
        body: z.string().min(1, t`Content is required`),
      }),
    [t],
  )
}

export type PostFormValues = z.infer<ReturnType<typeof usePostSchema>>
