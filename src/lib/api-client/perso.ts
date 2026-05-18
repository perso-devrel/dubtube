import type {
  DownloadResponse,
  DownloadTarget,
  ExternalMetadataResponse,
  MediaValidateRequest,
  PersoLanguage,
  PersoSpace,
  ProgressResponse,
  ProjectDetail,
  SasTokenResponse,
  ScriptSentence,
  TranslateRequest,
  TranslateResponse,
  UploadVideoResponse,
} from '@/lib/perso/types'
import { getJson, sendJson } from './shared'

const PERSO = '/api/perso'

function withExternalLang(
  body: { spaceSeq: number; url: string },
  lang?: string,
) {
  const normalizedLang = lang?.trim()
  if (!normalizedLang || normalizedLang === 'auto') return body
  return { ...body, lang: normalizedLang }
}

// ─── Spaces & Languages ───────────────────────────────────────

export function getSpaces() {
  return getJson<PersoSpace[]>(`${PERSO}/spaces`)
}

export function getLanguages() {
  return getJson<PersoLanguage[]>(`${PERSO}/languages`)
}

// ─── External (YouTube) ───────────────────────────────────────

export function getExternalMetadata(
  spaceSeq: number,
  url: string,
  lang?: string,
): Promise<ExternalMetadataResponse> {
  return sendJson(`${PERSO}/external/metadata`, 'POST', withExternalLang({ spaceSeq, url }, lang))
}

export function uploadExternalVideo(
  spaceSeq: number,
  url: string,
  lang?: string,
): Promise<UploadVideoResponse> {
  return sendJson(`${PERSO}/external/upload`, 'PUT', withExternalLang({ spaceSeq, url }, lang))
}

// ─── Direct file upload (SAS → Blob → register) ──────────────

export function getSasToken(fileName: string): Promise<SasTokenResponse> {
  const qs = new URLSearchParams({ fileName }).toString()
  return getJson<SasTokenResponse>(`${PERSO}/upload/sas-token?${qs}`)
}

export async function uploadFileToBlob(
  sasUrl: string,
  file: File,
  onProgress?: (pct: number) => void,
  contentType = 'application/octet-stream',
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', sasUrl)
    xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob')
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Blob upload failed: ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('Network error during blob upload'))
    xhr.send(file)
  })
}

export function registerUploadedVideo(
  spaceSeq: number,
  fileUrl: string,
  fileName: string,
): Promise<UploadVideoResponse> {
  return sendJson(`${PERSO}/upload/register`, 'PUT', {
    spaceSeq,
    fileUrl,
    fileName,
  })
}

export async function uploadVideoFile(
  spaceSeq: number,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<UploadVideoResponse> {
  const { blobSasUrl } = await getSasToken(file.name)
  await uploadFileToBlob(blobSasUrl, file, onProgress)
  const fileUrl = blobSasUrl.split('?')[0]
  return registerUploadedVideo(spaceSeq, fileUrl, file.name)
}

// ─── Media validate ───────────────────────────────────────────

export function validateMedia(body: MediaValidateRequest) {
  return sendJson<unknown>(`${PERSO}/validate`, 'POST', body)
}

// ─── Queue & Translate ────────────────────────────────────────

export function initializeQueue(spaceSeq: number) {
  return sendJson<unknown>(
    `${PERSO}/queue?spaceSeq=${spaceSeq}`,
    'PUT',
  )
}

export function submitTranslation(
  spaceSeq: number,
  body: TranslateRequest,
): Promise<TranslateResponse> {
  return sendJson(`${PERSO}/translate?spaceSeq=${spaceSeq}`, 'POST', body)
}

// ─── Cancel ──────────────────────────────────────────────────

export function cancelProject(
  projectSeq: number,
  spaceSeq: number,
): Promise<unknown> {
  return sendJson(`${PERSO}/cancel?projectSeq=${projectSeq}&spaceSeq=${spaceSeq}`, 'POST')
}

// ─── Progress / Projects / Script ─────────────────────────────

export function getProjectProgress(
  projectSeq: number,
  spaceSeq: number,
): Promise<ProgressResponse> {
  return getJson(
    `${PERSO}/progress?projectSeq=${projectSeq}&spaceSeq=${spaceSeq}`,
  )
}

export function listProjects(spaceSeq: number): Promise<ProjectDetail[]> {
  return getJson(`${PERSO}/projects?spaceSeq=${spaceSeq}`)
}

export function getProjectDetail(
  projectSeq: number,
  spaceSeq: number,
): Promise<ProjectDetail> {
  return getJson(
    `${PERSO}/project?projectSeq=${projectSeq}&spaceSeq=${spaceSeq}`,
  )
}

export function getProjectScript(
  projectSeq: number,
  spaceSeq: number,
): Promise<ScriptSentence[]> {
  return getJson(
    `${PERSO}/script?projectSeq=${projectSeq}&spaceSeq=${spaceSeq}`,
  )
}

export function updateSentenceTranslation(
  projectSeq: number,
  sentenceSeq: number,
  translatedText: string,
) {
  return sendJson<unknown>(
    `${PERSO}/script?projectSeq=${projectSeq}&sentenceSeq=${sentenceSeq}`,
    'PATCH',
    { translatedText },
  )
}

export function regenerateSentenceAudio(
  projectSeq: number,
  audioSentenceSeq: number,
  targetText: string,
) {
  return sendJson<unknown>(
    `${PERSO}/script/regenerate?projectSeq=${projectSeq}&audioSentenceSeq=${audioSentenceSeq}`,
    'PATCH',
    { targetText },
  )
}

// ─── Download & Lip sync ──────────────────────────────────────

export function getDownloadLinks(
  projectSeq: number,
  spaceSeq: number,
  target: DownloadTarget = 'all',
): Promise<DownloadResponse> {
  return getJson(
    `${PERSO}/download?projectSeq=${projectSeq}&spaceSeq=${spaceSeq}&target=${target}`,
  )
}

export function requestLipSync(projectSeq: number, spaceSeq: number) {
  return sendJson<unknown>(
    `${PERSO}/lipsync?projectSeq=${projectSeq}&spaceSeq=${spaceSeq}`,
    'POST',
  )
}

/**
 * Perso가 생성한 SRT 자막 본문을 텍스트로 받는다.
 * 서버 라우트(/api/perso/srt)가 audioScript target으로 다운로드 링크를 얻고
 * perso-storage에서 파일을 받아 그대로 전달한다.
 */
export async function getTranslatedSrt(
  projectSeq: number,
  spaceSeq: number,
  kind: 'translated' | 'original' = 'translated',
): Promise<string> {
  const res = await fetch(
    `${PERSO}/srt?projectSeq=${projectSeq}&spaceSeq=${spaceSeq}&kind=${kind}`,
    { cache: 'no-store' },
  )
  if (!res.ok) {
    let msg = '자막 파일을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
    try {
      const body = await res.json()
      if (body?.error?.message) msg = body.error.message
    } catch {
      // raw error response
    }
    throw new Error(msg)
  }
  return res.text()
}

// ─── Helper: resolve Perso file path to full URL ──────────────

const PERSO_FILE_BASE =
  process.env.NEXT_PUBLIC_PERSO_FILE_BASE_URL || 'https://portal-media.perso.ai'

export function getPersoFileUrl(path: string): string {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return `${PERSO_FILE_BASE}${path.startsWith('/') ? '' : '/'}${path}`
}
