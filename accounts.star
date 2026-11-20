# Copyright © 2026 Mochisoft OÜ
# SPDX-License-Identifier: AGPL-3.0-only
# This file is part of Mochi, licensed under the GNU AGPL v3 with the
# Mochi Application Interface Exception - see license.txt and license-exception.md.

# Mochi forums app: Connected accounts
# Thin wrappers around mochi.account.* API

def action_accounts_providers(a):
    capability = a.input("capability")
    a.json(mochi.account.providers(capability))

def action_accounts_list(a):
    capability = a.input("capability")
    a.json(mochi.account.list(capability))

def action_networks(a):
    """The networks the server hosts accounts on: Find offers to set up an
    ActivityPub account where a community is looked for without one."""
    if not a.user:
        a.error.label(401, "errors.not_logged_in")
        return
    a.json({"data": {"networks": mochi.account.networks() or []}})
