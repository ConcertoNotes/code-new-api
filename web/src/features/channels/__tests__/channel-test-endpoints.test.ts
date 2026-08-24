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
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  CHANNEL_TEST_DISABLED_ENDPOINTS,
  CHANNEL_TEST_ENDPOINT_OPTIONS,
  CHANNEL_TEST_STREAM_INCOMPATIBLE_ENDPOINTS,
} from '../constants'

test('shows both video protocols but disables their automatic tests', () => {
  assert.deepEqual(
    CHANNEL_TEST_ENDPOINT_OPTIONS.find(
      (option) => option.value === 'openai-video'
    ),
    {
      value: 'openai-video',
      label: 'OpenAI Video (/v1/videos)',
    }
  )
  assert.deepEqual(
    CHANNEL_TEST_ENDPOINT_OPTIONS.find(
      (option) => option.value === 'video-generation'
    ),
    {
      value: 'video-generation',
      label: 'Video Generation (/v1/video/generations)',
    }
  )
  assert.equal(
    CHANNEL_TEST_STREAM_INCOMPATIBLE_ENDPOINTS.has('openai-video'),
    true
  )
  assert.equal(
    CHANNEL_TEST_STREAM_INCOMPATIBLE_ENDPOINTS.has('video-generation'),
    true
  )
  assert.equal(CHANNEL_TEST_DISABLED_ENDPOINTS.has('openai-video'), true)
  assert.equal(CHANNEL_TEST_DISABLED_ENDPOINTS.has('video-generation'), true)
})
