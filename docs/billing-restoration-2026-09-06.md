# Billing Restoration: 2026-09-06

## Evidence and Scope

The reflog records a reset from `db6c6bd2b` to `upstream/main` at
2026-09-05 02:24:18 UTC. The original code survives on `local-main-backup`.
This omitted local commits, including:

- `523190bd4`: exact video model price/ratio matching.
- `afd7dc322`, `107480991`: fixed per-call versus per-second billing and multiplier handling.
- `db6c6bd2b`: configured video resolution prices across public/upstream model names.

This patch restores their billing behavior on the current plugin-based task
architecture, rather than replacing upstream modules wholesale. It restores
`VideoGenerationPrice` and `ImageGenerationPrice` loading, validation, runtime
lookup, API exposure and administration. The video editor preserves custom
resolution names and distinguishes per-second prices from fixed request prices.
Existing expression pricing remains available.

Configured video prices are final customer prices: seconds are multiplied once,
group/provider multipliers are not added, and the selected price is frozen in the
existing task settlement snapshot. Explicit public-model pricing takes priority;
otherwise the mapped upstream model is checked. A missing configured resolution
fails instead of silently selecting a different price. Duration bounds and quota
saturation auditing remain enforced. Fixed request prices skip provider ratio
adjustments at both submission and completion.

Frontend restoration follows existing components and restores 15 translation
keys in all seven locales through the required i18n script workflow. A mobile
two-row tab height conflict was corrected. Image aliases can use their base
model's resolution price; image counts remain a separate, single multiplier.

## Data Preservation

No production model, channel, price, wallet, or historical billing values were
manually rewritten. Before/after deployment comparisons matched:

| Data | Count or MD5 |
| --- | --- |
| Channels: IDs, model lists, mappings | 40; `bd2d01b62b4ab4935fdbb413f7100280` |
| Model metadata: IDs and names | 16; `536b119d7b7f431ee1ab5de374bae35a` |
| ModelPrice | `35e9103b9ab170eca992b64c55f994e1` |
| ModelRatio | `b80e39aa5d93eeeea7d260776b9705a3` |
| CompletionRatio | `821013206c21fc8e1081bab112839a63` |
| VideoGenerationPrice | `7334e549d8fa867c2fcaadbb5083b976` |
| ImageGenerationPrice | `a8b2726303ce8788fbd426a0e8a2f5ef` |
| billing_setting.billing_expr | `6c445975e15eb4f32ce803aca6bb5450` |
| billing_setting.billing_mode | `be6c3a2ce30fa35ffa7b74370ef9fe88` |

These comparisons cover this restoration, not every historical change. The
stored video maps cover `grok-imagine-video`, `grok-imagine-video-1.5`,
`seedance-2-0`, and `seedance-2-5`. Several channel names use different Seedance
spellings without mappings; they were not silently merged or assigned new prices.

## Verification

Passed:

```sh
go test ./controller ./model ./relay ./relay/helper ./service ./setting/ratio_setting ./types
cd relaykit && GOWORK=off go build ./...
cd relaykit && GOWORK=off go test ./dto ./types
cd web && bun run typecheck
cd web && bun run build
cd web && bun run test src/features/system-settings/models/__tests__ src/components/__tests__/video-resolution-price-editor.test.tsx src/components/__tests__/video-resolution-pricing.test.ts
git diff --check
```

Database persistence tests used actual SQLite 3.50.4, MySQL 8.0.46, and
PostgreSQL 15.18. The isolated MySQL and PostgreSQL ports were 13316 and 15439.
With their test DSNs supplied as `TEST_MYSQL_DSN` and `TEST_POSTGRES_DSN`:

```sh
go test ./model -run TestGenerationPriceOptionsPersistence -count=1 -v
```

All three passed: fresh option-table creation, existing legacy price rows,
repeated reloads, update/delete persistence, invalid-price rejection, unrelated
option preservation, and storage-failure propagation without cache mutation.
No schema, driver, migration, or separate log-database path was changed. This is
not a full release-upgrade migration certification. Test containers were stopped.

Browser verification used mocked APIs and no production credentials or writes.
At desktop 1440x1000 and mobile 390x844, existing prices were visible and editable.
Changing one video price submitted only `VideoGenerationPrice`, preserved other
models and fixed prices, and persisted on reopening. Mobile tabs did not overlap
price fields and the document had no horizontal overflow. Five frontend test
files passed with eight tests. Changed frontend files passed oxlint; full-repo
`bun run lint` still reports pre-existing errors outside these changes.

## Deployment and Recovery

Built with the repository Dockerfile using `docker buildx build --builder
cpu-limited --load -t new-api:billing-restored-20260906 .`, then tagged locally as
`new-api:local`. Deployment uses:

Final running image ID:
`sha256:6d1d198d0d5e20905ad5a1e1b95e97a2d91d803e68c5c13a78026ade458a93ec`.
The public frontend serves `index.140881f2e6.js`, including the mobile layout fix.

```sh
docker compose up -d --no-deps --no-build --pull never new-api
```

Only the application container is recreated. Existing PostgreSQL, Redis, Caddy,
Cloudflared, volumes and networks are retained. Production `/api/status` returned
success, the container was healthy, and `/api/ratio_config` exposed the restored
stored video/image maps. No paid upstream generation was used for testing.

Recovery artifacts:

- Original source branch: `local-main-backup` (`db6c6bd2b`).
- Previous application image: `new-api:before-billing-restoration-20260906`.
- PostgreSQL dump and Compose backup: `/www/projects/new-api-restoration-backup-20260906-sAedFV/`.
- Dump SHA256: `1192a1160586359f175113a89249ee17100ee82130388e3cf20722c810341014`.
- Dump structure was checked with `pg_restore --list`; it was not restored over production.

Database backups, environment secrets, data, logs and exports are now excluded
from the Docker build context. Existing user backup/export files remain intact.

## Remaining Boundaries

This does not claim restoration of all 25 local commits or every personalized
feature. Blacklist, channel affinity, full image/video provider adaptations,
group-specific expression extensions, and wallet styling require separate
comparison with the backup. Historical overcharges, refunds and already-created
task snapshots were not rewritten. Any historical correction requires an audit
and explicit confirmation of the affected records and amounts.
