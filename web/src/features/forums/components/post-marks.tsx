// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
//
// A post's marks in the composer: whether it is sensitive, which readers see
// behind a warning, and the language it is in, which communities on other
// networks filter by.
import { useMemo } from 'react'
import type { Control, FieldValues, Path } from 'react-hook-form'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  describeLanguages,
} from '@mochi/web'

// The languages the app is translated into, by their primary subtag: the
// locale directories bundled with it, read at build time.
const LANGUAGES = Array.from(
  new Set(
    Object.keys(import.meta.glob('../../../locales/*/messages.po')).map(
      (path) => path.split('/').slice(-2)[0].split('-')[0]
    )
  )
)

// The Select's value for no language, which a Radix item cannot carry empty.
const NONE = 'none'

interface PostMarksProps<T extends FieldValues> {
  control: Control<T>
  disabled?: boolean
}

export function PostMarks<T extends FieldValues>({
  control,
  disabled,
}: PostMarksProps<T>) {
  const { t } = useLingui()
  const languages = useMemo(() => describeLanguages(LANGUAGES), [])
  return (
    <div className='flex flex-wrap items-end gap-4'>
      <FormField
        control={control}
        name={'language' as Path<T>}
        render={({ field }) => (
          <FormItem className='min-w-48 flex-1'>
            <FormLabel>
              <Trans>Language</Trans>
            </FormLabel>
            <Select
              value={(field.value as string) || NONE}
              onValueChange={(value) =>
                field.onChange(value === NONE ? '' : value)
              }
              disabled={disabled}
            >
              <FormControl>
                <SelectTrigger aria-label={t`Language`}>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value={NONE}>
                  <Trans>Not given</Trans>
                </SelectItem>
                {languages.map((language) => (
                  <SelectItem key={language.tag} value={language.tag}>
                    {language.native}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={'sensitive' as Path<T>}
        render={({ field }) => (
          <FormItem className='flex h-9 items-center gap-2 space-y-0'>
            <FormControl>
              <Switch
                checked={!!field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
                aria-label={t({
                  message: 'Sensitive',
                  context: 'content warning',
                })}
              />
            </FormControl>
            <FormLabel className='font-normal'>
              <Trans context='content warning'>Sensitive</Trans>
            </FormLabel>
          </FormItem>
        )}
      />
    </div>
  )
}
