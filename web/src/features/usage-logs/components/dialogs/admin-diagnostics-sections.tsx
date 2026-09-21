/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { ArrowLeftRight, Network, ScanSearch } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatusBadge, type StatusVariant } from '@/components/status-badge'
import { getChannelTypeLabel } from '@/features/channels/lib/channel-utils'
import { formatLogQuota } from '@/lib/format'

import type { UsageLog } from '../../data/schema'
import {
  UPSTREAM_MODEL_AUDIT_LABEL_KEY,
  getUpstreamModelAudit,
  type UpstreamModelAuditStatus,
} from '../../lib/model-audit'
import type { LogOtherData, UpstreamUsageSnapshot } from '../../types'
import { DetailRow, DetailSection } from './detail-primitives'

const MODEL_AUDIT_BADGE_VARIANT: Record<
  UpstreamModelAuditStatus,
  StatusVariant
> = {
  unknown: 'neutral',
  match: 'success',
  variant: 'warning',
  mismatch: 'danger',
}

function formatMilliseconds(ms: number | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '-'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function formatByteSize(bytes: number | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function httpStatusVariant(status: number | undefined): StatusVariant {
  if (status == null) return 'neutral'
  if (status >= 200 && status < 300) return 'success'
  if (status >= 400) return 'danger'
  return 'warning'
}

const UPSTREAM_USAGE_ROWS: Array<{
  key: keyof UpstreamUsageSnapshot
  label: string
}> = [
  { key: 'prompt_tokens', label: 'Input Tokens' },
  { key: 'completion_tokens', label: 'Output Tokens' },
  { key: 'total_tokens', label: 'Total Tokens' },
  { key: 'cached_tokens', label: 'Cache Read' },
  { key: 'cache_creation_tokens', label: 'Cache Creation' },
  { key: 'cache_write_tokens', label: 'Cache Write' },
  { key: 'reasoning_tokens', label: 'Reasoning Tokens' },
]

/**
 * Admin-only: compares the requested model, the model sent upstream and the
 * model the upstream response declared, plus the mapping chain and any
 * reasoning-effort rewrite applied before forwarding.
 */
export function ModelAuditSection(props: {
  log: UsageLog
  other: LogOtherData
}) {
  const { t } = useTranslation()
  const adminInfo = props.other.admin_info
  const audit = getUpstreamModelAudit(props.log.model_name, props.other)
  const mappingChain = adminInfo?.model_mapping_chain
  const billingModel = adminInfo?.billing_model
  const upstreamEffort = adminInfo?.upstream_reasoning_effort
  const hasContent =
    audit != null ||
    !!mappingChain ||
    !!billingModel ||
    !!upstreamEffort ||
    !!adminInfo?.sent_model

  if (!adminInfo || !hasContent) return null

  const sentModel = audit?.sentModel ?? adminInfo.sent_model ?? ''

  return (
    <DetailSection
      icon={<ScanSearch className='size-3.5' aria-hidden='true' />}
      iconTone='info'
      label={t('Model Audit')}
    >
      <DetailRow label={t('Request Model')} value={props.log.model_name} mono />
      {sentModel && (
        <DetailRow label={t('Sent Upstream')} value={sentModel} mono />
      )}
      {audit ? (
        <DetailRow
          label={t('Upstream Response')}
          value={
            <span className='flex flex-wrap items-center gap-1.5'>
              <span className='font-mono'>{audit.responseModel}</span>
              <StatusBadge
                label={t(UPSTREAM_MODEL_AUDIT_LABEL_KEY[audit.status])}
                variant={MODEL_AUDIT_BADGE_VARIANT[audit.status]}
                size='sm'
                copyable={false}
              />
              {adminInfo.upstream_response_model_conflict && (
                <StatusBadge
                  label={t('Multiple models declared')}
                  variant='warning'
                  size='sm'
                  copyable={false}
                />
              )}
            </span>
          }
        />
      ) : (
        <DetailRow
          label={t('Upstream Response')}
          value={t('Not declared')}
          muted
        />
      )}
      {mappingChain && (
        <DetailRow label={t('Mapping Chain')} value={mappingChain} mono />
      )}
      {billingModel && (
        <DetailRow label={t('Billing Model')} value={billingModel} mono />
      )}
      {upstreamEffort && (
        <DetailRow
          label={t('Upstream Reasoning Effort')}
          value={
            <span className='flex items-center gap-1 font-mono'>
              {props.other.reasoning_effort ?? '-'}
              <ArrowLeftRight
                className='text-muted-foreground size-3'
                aria-hidden='true'
              />
              {upstreamEffort}
            </span>
          }
        />
      )}
    </DetailSection>
  )
}

/**
 * Admin-only: facts about the final upstream HTTP exchange (endpoint, status,
 * protocol, timing, payload sizes, finish reason, service tier, rate limits).
 */
export function UpstreamExchangeSection(props: { other: LogOtherData }) {
  const { t } = useTranslation()
  const upstream = props.other.admin_info?.upstream
  if (!upstream) return null

  const ratelimitEntries = Object.entries(upstream.ratelimit ?? {}).sort(
    ([a], [b]) => a.localeCompare(b)
  )

  return (
    <DetailSection
      icon={<Network className='size-3.5' aria-hidden='true' />}
      iconTone='chart-2'
      label={t('Upstream Exchange')}
    >
      {upstream.endpoint && (
        <DetailRow label={t('Endpoint')} value={upstream.endpoint} mono />
      )}
      <DetailRow
        label={t('HTTP Status')}
        value={
          <span className='flex items-center gap-1.5'>
            {upstream.method && (
              <span className='font-mono'>{upstream.method}</span>
            )}
            <StatusBadge
              label={
                upstream.status_code != null
                  ? String(upstream.status_code)
                  : t('Unknown')
              }
              variant={httpStatusVariant(upstream.status_code)}
              size='sm'
              copyable={false}
            />
            {upstream.proto && (
              <span className='text-muted-foreground font-mono'>
                {upstream.proto}
              </span>
            )}
          </span>
        }
      />
      {upstream.content_type && (
        <DetailRow
          label={t('Content Type')}
          value={upstream.content_type}
          mono
          muted
        />
      )}
      <DetailRow
        label={t('Upstream Timing')}
        value={`${t('TTFB')} ${formatMilliseconds(upstream.ttfb_ms)} · ${t('Total')} ${formatMilliseconds(upstream.duration_ms)}`}
        mono
      />
      {upstream.processing_ms != null && (
        <DetailRow
          label={t('Upstream Processing')}
          value={formatMilliseconds(upstream.processing_ms)}
          mono
        />
      )}
      <DetailRow
        label={t('Payload Size')}
        value={`${t('Request')} ${formatByteSize(upstream.request_bytes)} · ${t('Response')} ${formatByteSize(upstream.response_bytes)}`}
        mono
      />
      {upstream.finish_reason && (
        <DetailRow
          label={t('Finish Reason')}
          value={upstream.finish_reason}
          mono
        />
      )}
      {upstream.service_tier && (
        <DetailRow
          label={t('Service Tier')}
          value={upstream.service_tier}
          mono
        />
      )}
      {ratelimitEntries.length > 0 && (
        <DetailRow
          label={t('Rate Limit Headers')}
          value={
            <span className='flex flex-col gap-0.5 font-mono'>
              {ratelimitEntries.map(([name, value]) => (
                <span key={name}>
                  <span className='text-muted-foreground'>{name}:</span> {value}
                </span>
              ))}
            </span>
          }
        />
      )}
    </DetailSection>
  )
}

/**
 * Admin-only: routing and pre-flight facts (channel, attempt, local token
 * estimate vs upstream usage, pre-consumed quota, pass-through / header
 * override, serving node and version).
 */
export function RequestRoutingSection(props: { other: LogOtherData }) {
  const { t } = useTranslation()
  const adminInfo = props.other.admin_info
  if (!adminInfo) return null

  const usage = adminInfo.upstream_usage ?? {}
  const usageRows = UPSTREAM_USAGE_ROWS.flatMap((row) => {
    const value = usage[row.key]
    if (typeof value !== 'number' || value <= 0) return []
    return [{ key: row.key, label: row.label, value }]
  })
  const hasContent =
    adminInfo.channel_type != null ||
    !!adminInfo.channel_base_url ||
    adminInfo.retry_index != null ||
    adminInfo.estimated_prompt_tokens != null ||
    adminInfo.pre_consumed_quota != null ||
    usageRows.length > 0 ||
    !!adminInfo.pass_through_body ||
    (adminInfo.header_override_keys?.length ?? 0) > 0 ||
    !!adminInfo.node_name ||
    !!adminInfo.version

  if (!hasContent) return null

  return (
    <DetailSection
      icon={<ArrowLeftRight className='size-3.5' aria-hidden='true' />}
      iconTone='chart-3'
      label={t('Routing Diagnostics')}
    >
      {adminInfo.channel_type != null && (
        <DetailRow
          label={t('Channel Type')}
          value={`${getChannelTypeLabel(adminInfo.channel_type)} (#${adminInfo.channel_type})`}
        />
      )}
      {adminInfo.channel_base_url && (
        <DetailRow
          label={t('Base URL')}
          value={adminInfo.channel_base_url}
          mono
        />
      )}
      {adminInfo.retry_index != null && (
        <DetailRow
          label={t('Attempt')}
          value={
            adminInfo.retry_index > 0
              ? t('Retry #{{index}}', { index: adminInfo.retry_index })
              : t('First attempt')
          }
        />
      )}
      {adminInfo.estimated_prompt_tokens != null && (
        <DetailRow
          label={t('Estimated Input')}
          value={adminInfo.estimated_prompt_tokens.toLocaleString()}
          mono
        />
      )}
      {usageRows.map((row) => (
        <DetailRow
          key={row.key}
          label={`${t('Upstream')} · ${t(row.label)}`}
          value={row.value.toLocaleString()}
          mono
        />
      ))}
      {usage.source && (
        <DetailRow label={t('Usage Source')} value={usage.source} mono muted />
      )}
      {adminInfo.pre_consumed_quota != null && (
        <DetailRow
          label={t('Pre-consumed')}
          value={formatLogQuota(adminInfo.pre_consumed_quota)}
          mono
        />
      )}
      {adminInfo.pass_through_body && (
        <DetailRow
          label={t('Pass-through')}
          value={
            <StatusBadge
              label={t('Enabled')}
              variant='info'
              size='sm'
              copyable={false}
            />
          }
        />
      )}
      {(adminInfo.header_override_keys?.length ?? 0) > 0 && (
        <DetailRow
          label={t('Header Override')}
          value={adminInfo.header_override_keys?.join(', ')}
          mono
        />
      )}
      {adminInfo.node_name && (
        <DetailRow label={t('Node Name')} value={adminInfo.node_name} mono />
      )}
      {adminInfo.version && (
        <DetailRow
          label={t('System Version')}
          value={adminInfo.version}
          mono
          muted
        />
      )}
    </DetailSection>
  )
}
