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

export function buildVideoSubmitExamples(
  baseUrl: string
): Record<ExampleLanguage, string> {
  return {
    curl: `curl ${baseUrl}/v1/video/generations \\
  -H "Authorization: Bearer $NEW_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "kling-v1",
    "prompt": "A serene mountain lake at sunrise, mist rising from the water",
    "duration": 5,
    "aspect_ratio": "16:9",
    "n": 1
  }'`,
    python: `import os
import requests

response = requests.post(
    "${baseUrl}/v1/video/generations",
    headers={
        "Authorization": f"Bearer {os.environ['NEW_API_KEY']}",
        "Content-Type": "application/json",
    },
    json={
        "model": "kling-v1",
        "prompt": "A serene mountain lake at sunrise, mist rising from the water",
        "duration": 5,
        "aspect_ratio": "16:9",
        "n": 1,
    },
    timeout=30,
)
response.raise_for_status()
task = response.json()
print("Task ID:", task["id"])`,
    javascript: `const response = await fetch('${baseUrl}/v1/video/generations', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.NEW_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'kling-v1',
    prompt: 'A serene mountain lake at sunrise, mist rising from the water',
    duration: 5,
    aspect_ratio: '16:9',
    n: 1,
  }),
})

if (!response.ok) throw new Error(await response.text())
const task = await response.json()
console.log('Task ID:', task.id)`,
  }
}

export function buildVideoPollExamples(
  baseUrl: string
): Record<ExampleLanguage, string> {
  return {
    curl: `curl ${baseUrl}/v1/video/generations/{task_id} \\
  -H "Authorization: Bearer $NEW_API_KEY"`,
    python: `import os, time
import requests

BASE = "${baseUrl}"
HEADERS = {"Authorization": f"Bearer {os.environ['NEW_API_KEY']}"}
TASK_ID = "<task_id>"

while True:
    r = requests.get(f"{BASE}/v1/video/generations/{TASK_ID}", headers=HEADERS)
    r.raise_for_status()
    result = r.json()
    status = result.get("status")
    print("Status:", status)
    if status == "succeeded":
        print("Video URL:", result["data"][0]["url"])
        break
    if status == "failed":
        raise RuntimeError(result.get("error", "generation failed"))
    time.sleep(5)`,
    javascript: `const BASE = '${baseUrl}'
const HEADERS = { Authorization: \`Bearer \${process.env.NEW_API_KEY}\` }
const TASK_ID = '<task_id>'

async function poll() {
  while (true) {
    const res = await fetch(\`\${BASE}/v1/video/generations/\${TASK_ID}\`, {
      headers: HEADERS,
    })
    if (!res.ok) throw new Error(await res.text())
    const result = await res.json()
    console.log('Status:', result.status)
    if (result.status === 'succeeded') {
      console.log('Video URL:', result.data[0].url)
      return
    }
    if (result.status === 'failed') throw new Error(result.error)
    await new Promise((r) => setTimeout(r, 5000))
  }
}

poll()`,
  }
}

export function buildImageToVideoExamples(
  baseUrl: string
): Record<ExampleLanguage, string> {
  return {
    curl: `curl ${baseUrl}/v1/video/generations \\
  -H "Authorization: Bearer $NEW_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "kling-v1",
    "prompt": "The eagle spreads its wings and soars into the sky",
    "image_url": "https://example.com/eagle.jpg",
    "duration": 5,
    "aspect_ratio": "16:9"
  }'`,
    python: `import os
import requests

response = requests.post(
    "${baseUrl}/v1/video/generations",
    headers={
        "Authorization": f"Bearer {os.environ['NEW_API_KEY']}",
        "Content-Type": "application/json",
    },
    json={
        "model": "kling-v1",
        "prompt": "The eagle spreads its wings and soars into the sky",
        "image_url": "https://example.com/eagle.jpg",
        "duration": 5,
        "aspect_ratio": "16:9",
    },
    timeout=30,
)
response.raise_for_status()
print(response.json())`,
    javascript: `const response = await fetch('${baseUrl}/v1/video/generations', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.NEW_API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'kling-v1',
    prompt: 'The eagle spreads its wings and soars into the sky',
    image_url: 'https://example.com/eagle.jpg',
    duration: 5,
    aspect_ratio: '16:9',
  }),
})

if (!response.ok) throw new Error(await response.text())
console.log(await response.json())`,
  }
}
