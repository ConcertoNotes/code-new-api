import assert from 'node:assert/strict'

import { describe, test } from 'vitest'

import {
  CHANNEL_FORM_DEFAULT_VALUES,
  transformFormDataToCreatePayload,
} from '../channel-form'

describe('image mask channel capability', () => {
  test('persists the capability for an OpenAI-compatible channel', () => {
    const result = transformFormDataToCreatePayload({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: 'Image upstream',
      type: 1,
      key: 'test-key',
      models: 'gpt-image-2',
      supports_image_mask: true,
    })

    const settings = JSON.parse(String(result.channel.settings))
    assert.equal(settings.supports_image_mask, true)
  })

  test('removes the capability from unrelated channel types', () => {
    const result = transformFormDataToCreatePayload({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: 'Anthropic upstream',
      type: 14,
      key: 'test-key',
      models: 'claude-sonnet',
      settings: '{"supports_image_mask":true}',
      supports_image_mask: true,
    })

    const settings = JSON.parse(String(result.channel.settings))
    assert.equal('supports_image_mask' in settings, false)
  })
})
