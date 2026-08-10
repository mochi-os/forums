// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
// Shell storage for the forums app - remembers the last visited forum.
// null means the "All Forums" view, a forum ID means a specific forum.
import { createLastEntityStorage } from '@mochi/web'

const storage = createLastEntityStorage('mochi-forums-last')

export const setLastForum = storage.set
export const getLastForum = storage.get
export const clearLastForum = storage.clear
