import { createWriteStream, renameSync, rmSync } from 'node:fs'
import { get } from 'node:https'
import { pipeline } from 'node:stream/promises'

export const RELEASE_REPO = 'itriedcoding/Fluenta-Chat'
const LATEST_API = `https://api.github.com/repos/${RELEASE_REPO}/releases/latest`

export interface ReleaseAsset {
  name: string
  size: number
  browser_download_url: string
}

export interface Release {
  tag_name: string
  html_url: string
  published_at: string
  assets: ReleaseAsset[]
}

const follow = (url: string, redirects = 5): Promise<NodeJS.ReadableStream> =>
  new Promise((resolve, reject) => {
    if (redirects <= 0) {
      reject(new Error('Too many redirects'))
      return
    }
    get(
      url,
      {
        headers: {
          'User-Agent': 'Fluenta-Mod-Installer',
          Accept: 'application/vnd.github+json, application/octet-stream',
        },
      },
      (response) => {
        const status = response.statusCode ?? 0
        if (status >= 300 && status < 400 && response.headers.location) {
          resolve(follow(response.headers.location, redirects - 1))
          return
        }
        if (status !== 200) {
          response.resume()
          reject(new Error(`Request failed with HTTP ${status} (${url})`))
          return
        }
        resolve(response)
      },
    ).on('error', reject)
  })

export async function fetchLatestRelease(): Promise<Release | null> {
  const stream = await follow(LATEST_API)
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer))
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.includes('"Not Found"')) return null
  return JSON.parse(text) as Release
}

export async function downloadTo(url: string, destination: string): Promise<void> {
  const stream = await follow(url)
  const temporary = `${destination}.download`
  rmSync(temporary, { force: true })
  await pipeline(stream, createWriteStream(temporary))
  renameSync(temporary, destination)
}
