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
export type ExampleLanguage = 'curl' | 'python' | 'javascript'

export const exampleLanguageLabels: Record<ExampleLanguage, string> = {
  curl: 'cURL',
  python: 'Python',
  javascript: 'JavaScript',
}

export function buildGenerationExamples(
  baseUrl: string
): Record<ExampleLanguage, string> {
  return {
    curl: `curl ${baseUrl}/v1/images/generations \\
  -H "Authorization: Bearer $NEW_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-image-2",
    "prompt": "A cinematic city street after rain, realistic reflections",
    "n": 1,
    "size": "1536x1024",
    "resolution": "4K",
    "aspect_ratio": "16:9",
    "quality": "high",
    "response_format": "url"
  }'`,
    python: `import os
import requests

response = requests.post(
    "${baseUrl}/v1/images/generations",
    headers={
        "Authorization": f"Bearer {os.environ['NEW_API_KEY']}",
        "Content-Type": "application/json",
    },
    json={
        "model": "gpt-image-2",
        "prompt": "A cinematic city street after rain, realistic reflections",
        "n": 1,
        "size": "1536x1024",
        "resolution": "4K",
        "aspect_ratio": "16:9",
        "quality": "high",
        "response_format": "url",
    },
    timeout=300,
)
response.raise_for_status()
print(response.json())`,
    javascript: `const response = await fetch('${baseUrl}/v1/images/generations', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.NEW_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-image-2',
    prompt: 'A cinematic city street after rain, realistic reflections',
    n: 1,
    size: '1536x1024',
    resolution: '4K',
    aspect_ratio: '16:9',
    quality: 'high',
    response_format: 'url',
  }),
})

if (!response.ok) throw new Error(await response.text())
console.log(await response.json())`,
  }
}

export function buildEditExamples(
  baseUrl: string
): Record<ExampleLanguage, string> {
  return {
    curl: `curl ${baseUrl}/v1/images/edits \\
  -H "Authorization: Bearer $NEW_API_KEY" \\
  -F "model=gpt-image-2" \\
  -F "image=@./input.png" \\
  -F "mask=@./mask.png" \\
  -F "prompt=Replace the background with a clean photography studio" \\
  -F "size=2048x1536" \\
  -F "n=1"`,
    python: `import os
import requests

with open("input.png", "rb") as image, open("mask.png", "rb") as mask:
    response = requests.post(
        "${baseUrl}/v1/images/edits",
        headers={"Authorization": f"Bearer {os.environ['NEW_API_KEY']}"},
        files={
            "image": ("input.png", image, "image/png"),
            "mask": ("mask.png", mask, "image/png"),
        },
        data={
            "model": "gpt-image-2",
            "prompt": "Replace the background with a clean photography studio",
            "size": "2048x1536",
            "n": "1",
        },
        timeout=300,
    )

response.raise_for_status()
print(response.json())`,
    javascript: `import fs from 'node:fs'

const form = new FormData()
form.set('model', 'gpt-image-2')
form.set('prompt', 'Replace the background with a clean photography studio')
form.set('size', '2048x1536')
form.set('n', '1')
form.set('image', new Blob([fs.readFileSync('input.png')]), 'input.png')
form.set('mask', new Blob([fs.readFileSync('mask.png')]), 'mask.png')

const response = await fetch('${baseUrl}/v1/images/edits', {
  method: 'POST',
  headers: { Authorization: \`Bearer \${process.env.NEW_API_KEY}\` },
  body: form,
})

if (!response.ok) throw new Error(await response.text())
console.log(await response.json())`,
  }
}

export function buildDataUriEditExample(baseUrl: string): string {
  return `curl ${baseUrl}/v1/images/edits \\
  -H "Authorization: Bearer $NEW_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-image-2",
    "prompt": "Add a small red vase to the table",
    "image": "data:image/png;base64,iVBORw0KGgoAAA...",
    "mask": "data:image/png;base64,iVBORw0KGgoAAA...",
    "size": "2048x2048",
    "n": 1
  }'`
}
