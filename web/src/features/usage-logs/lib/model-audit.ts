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
import type { LogOtherData } from '../types'

/**
 * Outcome of comparing the model sent upstream with the model the upstream
 * response declared (admin-only audit, mirrors the backend
 * `admin_info.upstream_model_mismatch` tri-state):
 * - `unknown`: the upstream response declared no model
 * - `match`: identical (case-insensitive)
 * - `variant`: differs only by a `-latest` / date / build suffix, i.e. the
 *   upstream resolved an alias to a concrete snapshot
 * - `mismatch`: a genuinely different model was served
 */
export type UpstreamModelAuditStatus =
  | 'unknown'
  | 'match'
  | 'variant'
  | 'mismatch'

export interface UpstreamModelAudit {
  status: UpstreamModelAuditStatus
  requestedModel: string
  sentModel: string
  responseModel: string
}

export const UPSTREAM_MODEL_AUDIT_LABEL_KEY: Record<
  UpstreamModelAuditStatus,
  string
> = {
  unknown: 'Not declared',
  match: 'Model Match',
  variant: 'Model Variant',
  mismatch: 'Model Mismatch',
}

/**
 * Strips alias/snapshot suffixes so `gpt-4o` and `gpt-4o-2024-08-06` (or
 * `claude-sonnet-4-5` and `claude-sonnet-4-5-20250929`) compare equal.
 */
export function normalizeModelVariant(model: string): string {
  return model
    .trim()
    .toLowerCase()
    .replace(/-latest$/, '')
    .replace(/-\d{4}-\d{2}-\d{2}$/, '')
    .replace(/-\d{8}$/, '')
    .replace(/-preview(?:-\d{2}-\d{2})?$/, '')
}

export function classifyUpstreamModel(
  sentModel: string,
  responseModel: string
): UpstreamModelAuditStatus {
  const sent = sentModel.trim()
  const response = responseModel.trim()
  if (response === '') return 'unknown'
  if (sent === '') return 'mismatch'
  if (sent.toLowerCase() === response.toLowerCase()) return 'match'
  if (normalizeModelVariant(sent) === normalizeModelVariant(response)) {
    return 'variant'
  }
  return 'mismatch'
}

/**
 * Builds the admin model-audit view from a log row. Returns null when there is
 * no admin_info (non-admin viewer) or when the upstream declared no model, so
 * callers can skip rendering entirely.
 */
export function getUpstreamModelAudit(
  requestedModel: string,
  other: LogOtherData | null | undefined
): UpstreamModelAudit | null {
  const adminInfo = other?.admin_info
  if (!adminInfo) return null
  const responseModel = adminInfo.upstream_response_model?.trim() ?? ''
  if (responseModel === '') return null
  const sentModel =
    adminInfo.sent_model?.trim() ||
    other?.upstream_model_name?.trim() ||
    requestedModel.trim()
  // The backend already decided whether the raw names differ; only refine a
  // confirmed mismatch into "variant" when the names share a normalized base.
  const backendMismatch = adminInfo.upstream_model_mismatch
  let status = classifyUpstreamModel(sentModel, responseModel)
  if (backendMismatch === false) status = 'match'
  return { status, requestedModel, sentModel, responseModel }
}
