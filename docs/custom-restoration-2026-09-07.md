# Customization Restoration: 2026-09-07

## Recovery Baseline

- Original customization reference: `local-main-backup` (`db6c6bd2b`).
- Current baseline: `edada070f`, plus existing uncommitted auth and XAI work.
- Recovery directory: `/www/projects/new-api-custom-restore-20260907-gJTdGn/`.
- Recovery files: source bundle, working-tree patch, untracked archive, database dump, Compose copy, deployment identity.
- Preserved image: `new-api:before-custom-restore-20260907`.
- Production data is not restored wholesale. Existing prices, channels, wallets,
  logs, and task snapshots must remain intact unless a specific correction is
  identified and verified.

## Work Ledger

| Area | Status |
| --- | --- |
| Pricing deletion and save failure handling | Delete success/failure tests and typecheck passed; image/video/group maps included |
| Channel failures, fallback groups, affinity | Core restored; selection/transport regression tests passed; broader tests pending |
| Group user allowlist and email/IP blacklist | Backend restored; allowlist tests passed; UI/database verification pending |
| Group expressions and official-price usage summaries | Restored and included in full Go test |
| Image response compatibility | Restored OpenAI image URL/base64 retry path; full Go test passed |
| Theme, home, navigation and announcements | Restored theme/home/nav wiring; frontend typecheck passed |
| Missing video price entries | Restored only missing Grok entries from verified Sep6 dump |
| Regression tests and three-database verification | Go suite, relaykit build, and MySQL/PostgreSQL migration tests passed; isolated DB containers stopped |
| Local image build and deployment verification | `new-api:custom-restored-20260907` built, tagged as `new-api:local`, deployed; container healthy |

Missing legacy files are not sufficient evidence of missing functionality:
upstream task providers now use JavaScript plugins. Changes are reconciled at
behavior boundaries instead of replacing current modules with old versions.
