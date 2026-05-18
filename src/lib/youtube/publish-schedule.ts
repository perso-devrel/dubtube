export type YouTubePrivacyStatus = 'public' | 'unlisted' | 'private'

const FALLBACK_TIME_ZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Toronto',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Istanbul',
  'Asia/Seoul',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Jakarta',
  'Asia/Dubai',
  'Australia/Sydney',
]

export function normalizePublishAt(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function getDefaultPublishTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function normalizePublishTimeZone(value: unknown): string {
  const fallback = getDefaultPublishTimeZone()
  if (typeof value !== 'string' || !value.trim()) return fallback
  const timeZone = value.trim()
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return timeZone
  } catch {
    return fallback
  }
}

export function getSupportedPublishTimeZones(): string[] {
  const supportedValuesOf = (Intl as typeof Intl & {
    supportedValuesOf?: (key: 'timeZone') => string[]
  }).supportedValuesOf
  const zones = supportedValuesOf
    ? supportedValuesOf.call(Intl, 'timeZone')
    : FALLBACK_TIME_ZONES
  return Array.from(new Set([getDefaultPublishTimeZone(), 'UTC', ...zones])).sort()
}

export function hasScheduledPublish(publishAt: string | null | undefined): publishAt is string {
  return normalizePublishAt(publishAt) !== null
}

export function isFuturePublishAt(publishAt: string | null | undefined): boolean {
  const normalized = normalizePublishAt(publishAt)
  return !normalized || new Date(normalized).getTime() > Date.now()
}

export function effectivePrivacyStatus(
  privacyStatus: YouTubePrivacyStatus | undefined,
  publishAt: string | null | undefined,
): YouTubePrivacyStatus {
  return hasScheduledPublish(publishAt) ? 'private' : privacyStatus ?? 'private'
}

function getTimeZoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: normalizePublishTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getTimeZoneParts(date, timeZone)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - date.getTime()
}

function parseDateTimeLocalValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const [, year, month, day, hour, minute] = match
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  }
}

export function toDateTimeLocalInputValue(
  value: string | null | undefined,
  timeZone = getDefaultPublishTimeZone(),
): string {
  const normalized = normalizePublishAt(value)
  if (!normalized) return ''
  const parts = getTimeZoneParts(new Date(normalized), timeZone)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`
}

export function fromDateTimeLocalInputValue(
  value: string,
  timeZone = getDefaultPublishTimeZone(),
): string | null {
  const parts = parseDateTimeLocalValue(value)
  if (!parts) return null
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
  let utcMs = localAsUtc
  for (let i = 0; i < 3; i += 1) {
    utcMs = localAsUtc - getTimeZoneOffsetMs(new Date(utcMs), timeZone)
  }
  return normalizePublishAt(new Date(utcMs).toISOString())
}

export function minDateTimeLocalInputValue(
  bufferMinutes = 1,
  timeZone = getDefaultPublishTimeZone(),
): string {
  return toDateTimeLocalInputValue(new Date(Date.now() + bufferMinutes * 60_000).toISOString(), timeZone)
}
