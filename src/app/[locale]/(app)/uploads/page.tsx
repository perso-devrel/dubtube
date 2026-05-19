'use client'

import NextImage from 'next/image'
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { Upload, Loader2, CheckCircle2, ExternalLink, Video, Settings2, Lock, CalendarClock, Bell, Image, ListPlus, Tag } from 'lucide-react'
import { Card, CardTitle, Button, Badge, Select, Input } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/layout/PageHeader'
import { LanguageBadge } from '@/components/shared/LanguageBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { formatDuration } from '@/utils/formatters'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import {
  ytUploadVideo,
  ytUploadCaption,
  ytUpdateVideoLocalizations,
  getDownloadLinks,
  getPersoFileUrl,
} from '@/lib/api-client'
import { dbMutationStrict } from '@/lib/api/dbMutation'
import { getLanguageByCode, toBcp47 } from '@/utils/languages'
import { extractVideoId } from '@/utils/validators'
import { useAppLocale, useLocaleText } from '@/hooks/useLocaleText'
import type { CompletedJobLanguage } from '@/lib/db/queries/dashboard'
import type { MessageKey } from '@/lib/i18n/clientMessages'
import { resolveCaptionTrackName } from '@/lib/youtube/captions'
import {
  parseYouTubeUploadSnapshot,
  snapshotMetadataJson,
  type YouTubeUploadSnapshot,
} from '@/lib/youtube/upload-snapshot'
import {
  effectivePrivacyStatus,
  fromDateTimeLocalInputValue,
  getDefaultPublishTimeZone,
  getSupportedPublishTimeZones,
  hasScheduledPublish,
  isFuturePublishAt,
  minDateTimeLocalInputValue,
  normalizePublishTimeZone,
  toDateTimeLocalInputValue,
} from '@/lib/youtube/publish-schedule'
import {
  DEFAULT_YOUTUBE_CATEGORY_ID,
  formatPlaylistIds,
  getYouTubeCategoryOptions,
  parsePlaylistIds,
} from '@/lib/youtube/upload-options'

type UploadState = 'idle' | 'fetching' | 'uploading' | 'done' | 'error'
type PrivacyStatus = 'public' | 'unlisted' | 'private'
type CompletedJobGroup = {
  id: number
  title: string
  durationMs: number
  createdAt: string
  thumbnail: string
  langs: CompletedJobLanguage[]
}
type UploadPreviewSource =
  | { kind: 'youtube'; videoId: string }
  | { kind: 'direct'; url: string }

interface UploadSettings {
  title: string
  description: string
  tags: string
  categoryId: string
  privacyStatus: PrivacyStatus
  publishAt: string | null
  publishAtTimeZone: string | null
  notifySubscribers: boolean
  thumbnailUrl: string
  thumbnailFile: File | null
  playlistIds: string
  uploadCaptions: boolean
  selfDeclaredMadeForKids: boolean
  containsSyntheticMedia: boolean
}

const PRIVACY_OPTIONS = [
  { value: 'private', labelKey: 'privacyStatus.private' },
  { value: 'unlisted', labelKey: 'privacyStatus.unlisted' },
  { value: 'public', labelKey: 'privacyStatus.public' },
] satisfies Array<{ value: PrivacyStatus; labelKey: MessageKey }>

type LocaleText = ReturnType<typeof useLocaleText>

async function fetchCompletedLanguages(uid: string, t: LocaleText): Promise<CompletedJobLanguage[]> {
  const res = await fetch(`/api/dashboard/completed-languages?uid=${encodeURIComponent(uid)}`, { cache: 'no-store' })
  const json = await res.json()
  if (!json.ok) throw new Error(json.error?.message || t('app.app.uploads.page.couldNotLoadVideosToUpload'))
  return json.data
}

function toAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return url.startsWith('http') ? url : getPersoFileUrl(url)
}

function buildFallbackSnapshot(item: CompletedJobLanguage, langName: string, t: LocaleText): YouTubeUploadSnapshot {
  const targetAssetKind = item.deliverable_mode === 'originalWithMultiAudio' ? 'original_video' : 'dubbed_video'
  const sourceKind = item.original_youtube_url ? 'my_youtube_video' : 'new_video'
  const title = `[${langName}] ${item.video_title}`
  const description = t('app.app.uploads.page.valueDubtubeAIDubbingInValue', { itemVideo_title: item.video_title, langName: langName })
  const tags = [t('app.app.uploads.page.dubtubeAIDubbingValue', { langName: langName })]
  const originalYouTubeVideoId = item.original_youtube_url ? extractVideoId(item.original_youtube_url) : null
  return {
    version: 1,
    uploadKind: sourceKind === 'my_youtube_video'
      ? targetAssetKind === 'original_video' ? 'my_video_original_captions' : 'my_video_dubbed_video'
      : targetAssetKind === 'original_video' ? 'new_video_original_captions' : 'new_video_dubbed_video',
    sourceKind,
    targetAssetKind,
    sourceLanguage: item.language_code,
    targetLanguage: item.language_code,
    selectedLanguages: [item.language_code],
    settings: {
      title,
      description,
      tags,
      categoryId: DEFAULT_YOUTUBE_CATEGORY_ID,
      privacyStatus: 'private',
      publishAt: null,
      publishAtTimeZone: getDefaultPublishTimeZone(),
      notifySubscribers: true,
      thumbnailUrl: item.video_thumbnail || '',
      playlistIds: [],
      uploadCaptions: true,
      selfDeclaredMadeForKids: false,
      containsSyntheticMedia: targetAssetKind === 'dubbed_video',
      attachOriginalLink: true,
    },
    metadata: {
      source: {
        title: item.video_title,
        description,
        finalDescription: description,
      },
      translated: {
        [item.language_code]: {
          title,
          description,
          finalDescription: description,
          containsSyntheticMedia: targetAssetKind === 'dubbed_video',
        },
      },
      localizations: {},
    },
    assets: {
      originalVideoUrl: item.original_video_url,
      originalYouTubeVideoId,
      originalYouTubeUrl: item.original_youtube_url,
      dubbedVideoUrl: item.dubbed_video_url,
      audioUrl: item.audio_url,
      srtUrl: item.srt_url,
    },
  }
}

function resolveSnapshot(item: CompletedJobLanguage, langName: string, t: LocaleText): YouTubeUploadSnapshot {
  const parsed = parseYouTubeUploadSnapshot(item.youtube_upload_snapshot_json)
  const fallback = buildFallbackSnapshot(item, langName, t)
  const snapshot = parsed ?? fallback
  const originalYouTubeUrl = snapshot.assets.originalYouTubeUrl ?? item.original_youtube_url
  return {
    ...snapshot,
    assets: {
      originalVideoUrl: snapshot.assets.originalVideoUrl ?? item.original_video_url,
      originalYouTubeVideoId: snapshot.assets.originalYouTubeVideoId
        ?? (originalYouTubeUrl ? extractVideoId(originalYouTubeUrl) : null)
        ?? fallback.assets.originalYouTubeVideoId,
      originalYouTubeUrl,
      dubbedVideoUrl: snapshot.assets.dubbedVideoUrl ?? item.dubbed_video_url,
      audioUrl: snapshot.assets.audioUrl ?? item.audio_url,
      srtUrl: snapshot.assets.srtUrl ?? item.srt_url,
    },
  }
}

function resolvePreviewSource(snapshot: YouTubeUploadSnapshot, item: CompletedJobLanguage): UploadPreviewSource | null {
  if (snapshot.targetAssetKind === 'original_video') {
    const youtubeVideoId = snapshot.assets.originalYouTubeVideoId
      ?? (snapshot.assets.originalYouTubeUrl ? extractVideoId(snapshot.assets.originalYouTubeUrl) : null)
    if (youtubeVideoId) return { kind: 'youtube', videoId: youtubeVideoId }
    const directUrl = toAssetUrl(snapshot.assets.originalVideoUrl ?? item.original_video_url)
    return directUrl ? { kind: 'direct', url: directUrl } : null
  }

  const dubbedVideoUrl = toAssetUrl(snapshot.assets.dubbedVideoUrl ?? item.dubbed_video_url)
  return dubbedVideoUrl ? { kind: 'direct', url: dubbedVideoUrl } : null
}

function buildSettingsFromSnapshot(snapshot: YouTubeUploadSnapshot, fallbackThumbnailUrl = ''): UploadSettings {
  const metadata = snapshot.metadata.translated[snapshot.targetLanguage]
  const title = snapshot.targetAssetKind === 'dubbed_video'
    ? metadata?.title || snapshot.settings.title
    : snapshot.metadata.source.title || snapshot.settings.title
  const description = snapshot.targetAssetKind === 'dubbed_video'
    ? metadata?.finalDescription || metadata?.description || snapshot.settings.description
    : snapshot.metadata.source.finalDescription || snapshot.metadata.source.description || snapshot.settings.description
  return {
    title,
    description,
    tags: snapshot.settings.tags.join(', '),
    categoryId: snapshot.settings.categoryId || DEFAULT_YOUTUBE_CATEGORY_ID,
    privacyStatus: snapshot.settings.privacyStatus,
    publishAt: snapshot.settings.publishAt,
    publishAtTimeZone: snapshot.settings.publishAtTimeZone,
    notifySubscribers: snapshot.settings.notifySubscribers,
    thumbnailUrl: snapshot.settings.thumbnailUrl || fallbackThumbnailUrl,
    thumbnailFile: null,
    playlistIds: formatPlaylistIds(snapshot.settings.playlistIds),
    uploadCaptions: snapshot.settings.uploadCaptions,
    selfDeclaredMadeForKids: snapshot.settings.selfDeclaredMadeForKids,
    containsSyntheticMedia: snapshot.settings.containsSyntheticMedia,
  }
}

function isExistingVideoCaptionUpload(snapshot: YouTubeUploadSnapshot): boolean {
  return snapshot.targetAssetKind === 'original_video' && Boolean(snapshot.assets.originalYouTubeVideoId)
}

function isCaptionUploadFlow(snapshot: YouTubeUploadSnapshot): boolean {
  return snapshot.targetAssetKind === 'original_video'
}

function ReadOnlyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="w-full">
      <p className="mb-1.5 text-sm font-medium text-ink-500 dark:text-ink-200">{label}</p>
      <div
        className={[
          'rounded-lg border border-paper-200 bg-paper-100 px-3 py-2 text-sm text-ink-600 dark:border-paper-800 dark:bg-paper-900/60 dark:text-ink-200',
          multiline ? 'min-h-24 whitespace-pre-wrap' : 'min-h-10 truncate',
        ].join(' ')}
      >
        {value || '-'}
      </div>
    </div>
  )
}

interface UploadSettingsModalProps {
  open: boolean
  onClose: () => void
  settings: UploadSettings
  onChange: (settings: UploadSettings) => void
  onConfirm: () => void
  isLoading: boolean
  langName: string
  previewSource: UploadPreviewSource | null
  previewLoading: boolean
  captionUploadFlow: boolean
  uploadsOriginalVideo: boolean
}

function UploadSettingsModal({
  open,
  onClose,
  settings,
  onChange,
  onConfirm,
  isLoading,
  langName,
  previewSource,
  previewLoading,
  captionUploadFlow,
  uploadsOriginalVideo,
}: UploadSettingsModalProps) {
  const t = useLocaleText()
  const locale = useAppLocale()
  const videoUploadFlow = !captionUploadFlow || uploadsOriginalVideo
  const categoryOptions = getYouTubeCategoryOptions(locale)
  const labels = {
    category: locale === 'ko' ? 'YouTube 카테고리' : 'YouTube category',
    thumbnailUrl: locale === 'ko' ? '썸네일 이미지 URL' : 'Thumbnail image URL',
    thumbnailFile: locale === 'ko' ? '썸네일 파일' : 'Thumbnail file',
    thumbnailPlaceholder: 'https://.../thumbnail.png',
    playlists: locale === 'ko' ? '추가할 플레이리스트 ID' : 'Playlist IDs to add',
    playlistsPlaceholder: locale === 'ko'
      ? 'PL..., UU... 쉼표로 구분'
      : 'PL..., UU... separated by commas',
    notifySubscribers: locale === 'ko' ? '구독자에게 알림 보내기' : 'Notify subscribers',
    postUploadOptions: locale === 'ko'
      ? '카테고리, 썸네일, 플레이리스트'
      : 'Category, thumbnail, and playlists',
  }
  const publishAtTimeZone = normalizePublishTimeZone(settings.publishAtTimeZone)
  const hasPublishSchedule = hasScheduledPublish(settings.publishAt)
  const visibilityValue = effectivePrivacyStatus(settings.privacyStatus, settings.publishAt)
  const scheduleInvalid = hasPublishSchedule && !isFuturePublishAt(settings.publishAt)
  const handlePublishAtChange = (value: string) => {
    const publishAt = fromDateTimeLocalInputValue(value, publishAtTimeZone)
    onChange({
      ...settings,
      publishAt,
      ...(publishAt ? { privacyStatus: 'private' as PrivacyStatus } : {}),
    })
  }
  const handlePublishAtTimeZoneChange = (timeZone: string) => {
    const nextTimeZone = normalizePublishTimeZone(timeZone)
    const localValue = toDateTimeLocalInputValue(settings.publishAt, publishAtTimeZone)
    onChange({
      ...settings,
      publishAtTimeZone: nextTimeZone,
      publishAt: localValue ? fromDateTimeLocalInputValue(localValue, nextTimeZone) : settings.publishAt,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={captionUploadFlow
        ? uploadsOriginalVideo
          ? t('app.app.uploads.page.uploadVideoAndCaptionsToYouTube')
          : t('app.app.uploads.page.uploadCaptionsToYouTube')
        : t('app.app.uploads.page.youTubeUploadSettings')}
      size="lg"
    >
      <div className="space-y-4">
        {previewLoading ? (
          <div className="aspect-video w-full animate-pulse rounded-lg bg-paper-100 dark:bg-paper-800" />
        ) : previewSource ? (
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-paper-200 bg-black dark:border-paper-800">
            {previewSource.kind === 'youtube' ? (
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${previewSource.videoId}`}
                title={settings.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <video
                className="h-full w-full bg-black object-contain"
                src={previewSource.url}
                controls
                preload="metadata"
              />
            )}
          </div>
        ) : null}

        {videoUploadFlow ? (
          <>
            <div className="rounded-lg border border-paper-200 bg-paper-100 p-3 text-sm text-ink-500 dark:border-paper-800 dark:bg-paper-900/40 dark:text-ink-200">
              <div className="flex items-start gap-2">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-paper-500 dark:text-paper-300" />
                <p>{t('app.app.uploads.page.lockedMetadataNotice')}</p>
              </div>
            </div>

            <ReadOnlyField label={t('app.app.uploads.page.title')} value={settings.title} />
            <ReadOnlyField label={t('app.app.uploads.page.description')} value={settings.description} multiline />
            <ReadOnlyField label={t('app.app.uploads.page.tags')} value={settings.tags} />

            <Select
              label={t('app.app.uploads.page.visibility')}
              value={visibilityValue}
              onChange={(e) => onChange({ ...settings, privacyStatus: e.target.value as PrivacyStatus })}
              disabled={hasPublishSchedule}
              options={PRIVACY_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
            />
            {hasPublishSchedule && (
              <p className="-mt-2 text-xs text-ink-500 dark:text-ink-200">
                {t('app.app.uploads.page.scheduledUploadsArePrivateUntilPublish')}
              </p>
            )}

            <div className="rounded-lg bg-paper-100 p-3 dark:bg-paper-800/50">
              <div className="flex min-w-0 items-start gap-2">
                <CalendarClock className="mt-0.5 h-4 w-4 flex-shrink-0 text-paper-500 dark:text-paper-300" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="text-sm text-ink-600 dark:text-ink-200">
                      {t('app.app.uploads.page.schedulePublish')}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-ink-500 dark:text-ink-200">
                      {t('app.app.uploads.page.schedulePublishDescription')}
                    </p>
                  </div>
                  <Input
                    type="datetime-local"
                    value={toDateTimeLocalInputValue(settings.publishAt, publishAtTimeZone)}
                    min={minDateTimeLocalInputValue(1, publishAtTimeZone)}
                    onChange={(e) => handlePublishAtChange(e.target.value)}
                    aria-label={t('app.app.uploads.page.schedulePublish')}
                  />
                  <Select
                    label={t('app.app.uploads.page.publishTimeZone')}
                    value={publishAtTimeZone}
                    onChange={(e) => handlePublishAtTimeZoneChange(e.target.value)}
                    options={getSupportedPublishTimeZones().map((timeZone) => ({
                      value: timeZone,
                      label: timeZone.replaceAll('_', ' '),
                    }))}
                  />
                  {scheduleInvalid && (
                    <p className="text-xs text-red-500">
                      {t('app.app.uploads.page.publishTimeMustBeFuture')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-paper-100 p-3 dark:bg-paper-800/50">
              <div className="mb-3 flex min-w-0 items-start gap-2">
                <Tag className="mt-0.5 h-4 w-4 flex-shrink-0 text-paper-500 dark:text-paper-300" />
                <p className="text-sm text-ink-600 dark:text-ink-200">
                  {labels.postUploadOptions}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label={labels.category}
                  value={settings.categoryId}
                  onChange={(e) => onChange({ ...settings, categoryId: e.target.value })}
                  options={categoryOptions}
                />
                <Input
                  label={labels.thumbnailUrl}
                  value={settings.thumbnailUrl}
                  onChange={(e) => onChange({ ...settings, thumbnailUrl: e.target.value })}
                  placeholder={labels.thumbnailPlaceholder}
                  icon={<Image className="h-4 w-4" />}
                />
                <div className="sm:col-span-2">
                  <Input
                    label={labels.playlists}
                    value={settings.playlistIds}
                    onChange={(e) => onChange({ ...settings, playlistIds: e.target.value })}
                    placeholder={labels.playlistsPlaceholder}
                    icon={<ListPlus className="h-4 w-4" />}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-ink-600 dark:text-ink-200">
                    {labels.thumbnailFile}
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => onChange({ ...settings, thumbnailFile: e.target.files?.[0] ?? null })}
                    className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-md file:border-0 file:bg-paper-200 file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink-600 hover:file:bg-paper-300 dark:text-ink-200 dark:file:bg-paper-700 dark:file:text-ink-50 dark:hover:file:bg-paper-600"
                  />
                </div>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-lg bg-paper-100 p-3 text-sm text-ink-600 dark:bg-paper-800/50 dark:text-ink-200">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-paper-300 text-clay-600 focus:ring-clay-500"
                checked={settings.notifySubscribers}
                onChange={(e) => onChange({ ...settings, notifySubscribers: e.target.checked })}
              />
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-paper-500 dark:text-paper-300" />
              <span>{labels.notifySubscribers}</span>
            </label>

            <label className="flex items-start gap-3 rounded-lg bg-paper-100 p-3 text-sm text-ink-600 dark:bg-paper-800/50 dark:text-ink-200">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-paper-300 text-clay-600 focus:ring-clay-500"
                checked={settings.uploadCaptions}
                onChange={(e) => onChange({ ...settings, uploadCaptions: e.target.checked })}
              />
              <span>{t('app.app.uploads.page.uploadTranslatedSRTCaptionsWithTheVideo')}</span>
            </label>

            <label className="flex items-start gap-3 rounded-lg bg-paper-100 p-3 text-sm text-ink-600 dark:bg-paper-800/50 dark:text-ink-200">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-paper-300 text-clay-600 focus:ring-clay-500"
                checked={settings.selfDeclaredMadeForKids}
                onChange={(e) => onChange({ ...settings, selfDeclaredMadeForKids: e.target.checked })}
              />
              <span>{t('app.app.uploads.page.madeForKids')}</span>
            </label>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-paper-200 bg-paper-100 p-3 text-sm text-ink-500 dark:border-paper-800 dark:bg-paper-900/60 dark:text-ink-200">
              <span>{t('app.app.uploads.page.discloseAIVoiceUse')}</span>
              <Badge variant={settings.containsSyntheticMedia ? 'warning' : 'default'}>
                {settings.containsSyntheticMedia ? t('app.app.uploads.page.on') : t('app.app.uploads.page.off')}
              </Badge>
            </div>
          </>
        ) : null}

        {!captionUploadFlow && (
          <div className="flex items-center gap-2 rounded-lg bg-paper-100 p-3 dark:bg-paper-800/50">
            <span className="text-xs text-ink-500 dark:text-ink-200">{t('app.app.uploads.page.language')}: {langName}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 pt-2 sm:flex sm:justify-end">
          {videoUploadFlow && (
            <Button size="sm" onClick={onClose} className="w-full sm:w-auto" variant="secondary">
              {t('app.app.uploads.page.cancel')}
            </Button>
          )}
          <Button size="sm" onClick={onConfirm} disabled={isLoading || scheduleInvalid || (videoUploadFlow && !settings.title.trim())} className="w-full sm:w-auto">
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('app.app.uploads.page.uploading')}
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                {captionUploadFlow
                  ? uploadsOriginalVideo
                    ? t('app.app.uploads.page.uploadVideoAndCaptionsToYouTube')
                    : t('app.app.uploads.page.uploadCaptionsToYouTube')
                  : t('app.app.uploads.page.upload')}
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

interface UploadRowProps {
  item: CompletedJobLanguage
  userId: string
  compact?: boolean
}

interface UploadRowHandle {
  upload: () => Promise<void>
}

const UploadRow = forwardRef<UploadRowHandle, UploadRowProps>(function UploadRow({ item, userId, compact = false }, ref) {
  const locale = useAppLocale()
  const t = useLocaleText()
  const addToast = useNotificationStore((s) => s.addToast)
  const queryClient = useQueryClient()
  const [state, setState] = useState<UploadState>(item.youtube_video_id ? 'done' : 'idle')
  const [videoId, setVideoId] = useState<string | null>(item.youtube_video_id)
  const lang = getLanguageByCode(item.language_code)
  const langName = (locale === 'ko' ? lang?.nativeName : lang?.name) || lang?.name || item.language_code
  const snapshot = resolveSnapshot(item, langName, t)
  const captionOnly = isExistingVideoCaptionUpload(snapshot)
  const captionUploadFlow = isCaptionUploadFlow(snapshot)
  const uploadsOriginalVideo = captionUploadFlow && !captionOnly
  const uploadKindLabel = snapshot.targetAssetKind === 'original_video'
    ? t('app.app.uploads.page.originalCaptionUpload')
    : t('app.app.uploads.page.dubbedVideoUpload')
  const captionLanguage = toBcp47(snapshot.targetLanguage || item.language_code)
  const captionTrackName = resolveCaptionTrackName(captionLanguage, lang?.name)

  const [modalOpen, setModalOpen] = useState(false)
  const [settings, setSettings] = useState<UploadSettings>(() => buildSettingsFromSnapshot(snapshot, item.video_thumbnail))
  const [previewSource, setPreviewSource] = useState<UploadPreviewSource | null>(() => resolvePreviewSource(snapshot, item))
  const [previewLoading, setPreviewLoading] = useState(false)

  const refetchAssetsFromPerso = useCallback(async (): Promise<{ video: string | null; srt: string | null }> => {
    if (!item.project_seq || !item.space_seq) return { video: null, srt: null }
    const [dubDl, allDl] = await Promise.all([
      getDownloadLinks(item.project_seq, item.space_seq, 'dubbingVideo'),
      getDownloadLinks(item.project_seq, item.space_seq, 'all'),
    ])
    const raw = dubDl.videoFile?.videoDownloadLink
      ?? allDl.videoFile?.videoDownloadLink
      ?? allDl.zippedFileDownloadLink
      ?? null
    const rawSrt = allDl.srtFile?.translatedSubtitleDownloadLink ?? null
    return { video: toAssetUrl(raw), srt: toAssetUrl(rawSrt) }
  }, [item.project_seq, item.space_seq])

  const handleOpenModal = useCallback(() => {
    const nextSnapshot = resolveSnapshot(item, langName, t)
    const nextPreview = resolvePreviewSource(nextSnapshot, item)
    setSettings(buildSettingsFromSnapshot(nextSnapshot, item.video_thumbnail))
    setPreviewSource(nextPreview)
    setPreviewLoading(false)
    setModalOpen(true)

    if (!nextPreview && nextSnapshot.targetAssetKind === 'dubbed_video') {
      setPreviewLoading(true)
      refetchAssetsFromPerso()
        .then((fresh) => {
          setPreviewSource(fresh.video ? { kind: 'direct', url: fresh.video } : null)
        })
        .catch(() => {
          setPreviewSource(null)
        })
        .finally(() => {
          setPreviewLoading(false)
        })
    }
  }, [item, langName, refetchAssetsFromPerso, t])

  const handleUpload = useCallback(async () => {
    setModalOpen(false)
    setState('fetching')
    try {
      const resolveSrtContent = async (): Promise<string | null> => {
        let srtUrl = toAssetUrl(snapshot.assets.srtUrl ?? item.srt_url)
        if (!srtUrl) {
          const fresh = await refetchAssetsFromPerso()
          srtUrl = fresh.srt
        }
        if (!srtUrl) return null
        const srtRes = await fetch(srtUrl)
        return srtRes.ok ? await srtRes.text() : null
      }

      const uploadPrivacyStatus = effectivePrivacyStatus(settings.privacyStatus, settings.publishAt)
      const effectiveSnapshot: YouTubeUploadSnapshot = {
        ...snapshot,
        settings: {
          ...snapshot.settings,
          categoryId: settings.categoryId,
          privacyStatus: uploadPrivacyStatus,
          publishAt: settings.publishAt,
          publishAtTimeZone: settings.publishAtTimeZone,
          notifySubscribers: settings.notifySubscribers,
          thumbnailUrl: settings.thumbnailUrl,
          playlistIds: parsePlaylistIds(settings.playlistIds),
          uploadCaptions: captionOnly ? true : settings.uploadCaptions,
          selfDeclaredMadeForKids: settings.selfDeclaredMadeForKids,
        },
      }
      const targetMetadata = snapshot.metadata.translated[snapshot.targetLanguage] ?? {
        title: settings.title,
        description: settings.description,
        finalDescription: settings.description,
        containsSyntheticMedia: settings.containsSyntheticMedia,
      }
      const metadataJson = snapshotMetadataJson(effectiveSnapshot)

      setState('uploading')
      const baseTags = snapshot.settings.tags
      let targetVideoId = snapshot.targetAssetKind === 'original_video'
        ? snapshot.assets.originalYouTubeVideoId ?? videoId
        : null
      let uploadTitle = settings.title
      let shouldPersistOriginalYouTubeUrl = Boolean(
        snapshot.targetAssetKind === 'original_video' &&
        targetVideoId &&
        !snapshot.assets.originalYouTubeVideoId,
      )

      if (!targetVideoId) {
        let videoUrl = snapshot.targetAssetKind === 'original_video'
          ? toAssetUrl(snapshot.assets.originalVideoUrl ?? item.original_video_url)
          : toAssetUrl(snapshot.assets.dubbedVideoUrl ?? item.dubbed_video_url)

        if (!videoUrl && snapshot.targetAssetKind === 'dubbed_video') {
          const fresh = await refetchAssetsFromPerso()
          videoUrl = fresh.video
        }
        if (!videoUrl) throw new Error(t('app.app.uploads.page.couldNotFindTheDubbedVideoDownloadLink'))

        const isOriginalVideoUpload = snapshot.targetAssetKind === 'original_video'
        uploadTitle = isOriginalVideoUpload
          ? snapshot.metadata.source.title || settings.title
          : targetMetadata.title || settings.title
        const uploadDescription = isOriginalVideoUpload
          ? snapshot.metadata.source.finalDescription || snapshot.metadata.source.description || settings.description
          : targetMetadata.finalDescription || targetMetadata.description || settings.description

        const doUpload = (url: string) =>
          ytUploadVideo({
            videoUrl: url,
            title: uploadTitle,
            description: uploadDescription,
            tags: baseTags,
            categoryId: settings.categoryId,
            privacyStatus: uploadPrivacyStatus,
            publishAt: settings.publishAt,
            notifySubscribers: settings.notifySubscribers,
            selfDeclaredMadeForKids: settings.selfDeclaredMadeForKids,
            containsSyntheticMedia: isOriginalVideoUpload ? false : settings.containsSyntheticMedia,
            language: isOriginalVideoUpload ? toBcp47(snapshot.sourceLanguage) : toBcp47(snapshot.targetLanguage),
            thumbnail: settings.thumbnailFile,
            thumbnailUrl: settings.thumbnailUrl,
            playlistIds: parsePlaylistIds(settings.playlistIds),
            localizations: isOriginalVideoUpload ? snapshot.metadata.localizations : undefined,
          })

        try {
          const result = await doUpload(videoUrl)
          targetVideoId = result.videoId
          shouldPersistOriginalYouTubeUrl = isOriginalVideoUpload
          if (isOriginalVideoUpload) setVideoId(result.videoId)
        } catch (err) {
          const msg = err instanceof Error ? err.message : ''
          const isFetchFailure = /VIDEO_FETCH_FAILED|fetch/i.test(msg)
          if (!isFetchFailure || !item.project_seq || !item.space_seq || isOriginalVideoUpload) throw err
          setState('fetching')
          const fresh = await refetchAssetsFromPerso()
          if (!fresh.video) throw err
          setState('uploading')
          const result = await doUpload(fresh.video)
          targetVideoId = result.videoId
          shouldPersistOriginalYouTubeUrl = isOriginalVideoUpload
          if (isOriginalVideoUpload) setVideoId(result.videoId)
        }
      }

      if (!targetVideoId) throw new Error(t('app.app.uploads.page.couldNotFindTheDubbedVideoDownloadLink'))

      if (shouldPersistOriginalYouTubeUrl) {
        await dbMutationStrict({
          type: 'updateDubbingJobOriginalYouTubeUrl',
          payload: {
            jobId: item.job_id,
            originalYouTubeUrl: `https://www.youtube.com/watch?v=${targetVideoId}`,
          },
        })
      }

      if (
        !captionOnly &&
        snapshot.targetAssetKind === 'original_video' &&
        snapshot.assets.originalYouTubeVideoId &&
        Object.keys(snapshot.metadata.localizations).length > 0
      ) {
        await ytUpdateVideoLocalizations({
          videoId: targetVideoId,
          sourceLang: toBcp47(snapshot.sourceLanguage),
          title: snapshot.metadata.source.title || item.video_title,
          description: snapshot.metadata.source.finalDescription || snapshot.metadata.source.description,
          tags: baseTags,
          localizations: snapshot.metadata.localizations,
        })
      }

      if (captionOnly || settings.uploadCaptions) {
        const srtText = await resolveSrtContent()
        if (srtText?.trim()) {
          await ytUploadCaption({
            videoId: targetVideoId,
            language: captionLanguage,
            name: captionTrackName,
            srtContent: srtText,
          })
        }
      }

      await Promise.all([
        dbMutationStrict({
          type: 'createYouTubeUpload',
          payload: {
            userId,
            youtubeVideoId: targetVideoId,
            title: uploadTitle,
            languageCode: item.language_code,
            privacyStatus: uploadPrivacyStatus,
            isShort: false,
            uploadKind: snapshot.uploadKind,
            metadataJson,
          },
        }),
        dbMutationStrict({
          type: 'updateJobLanguageYouTube',
          payload: {
            jobId: item.job_id,
            langCode: item.language_code,
            youtubeVideoId: targetVideoId,
          },
        }),
      ])

      setVideoId(targetVideoId)
      setState('done')

      const privacyLabelKey = PRIVACY_OPTIONS.find((o) => o.value === uploadPrivacyStatus)?.labelKey
      const publishLabel = settings.publishAt
        ? new Date(settings.publishAt).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')
        : null
      addToast({
        type: 'success',
        title: t('app.app.uploads.page.valueUploadComplete', { langName: langName }),
        message: publishLabel
          ? t('app.app.uploads.page.scheduledForValue', { publishLabel })
          : privacyLabelKey ? t(privacyLabelKey) : uploadPrivacyStatus,
      })

      queryClient.invalidateQueries({ queryKey: ['completed-languages'] })
    } catch (err) {
      setState('error')
      addToast({
        type: 'error',
        title: t('app.app.uploads.page.uploadFailed'),
        message: err instanceof Error ? err.message : t('app.app.uploads.page.anUnknownErrorOccurred'),
      })
    }
  }, [captionOnly, item, langName, locale, snapshot, captionLanguage, captionTrackName, settings, userId, videoId, addToast, queryClient, refetchAssetsFromPerso, t])

  const isLoading = state === 'fetching' || state === 'uploading'
  const loadingLabel = state === 'fetching'
    ? t('app.app.uploads.page.checkingDownloadLink')
    : t('app.app.uploads.page.uploading2')

  useImperativeHandle(ref, () => ({
    upload: async () => {
      if (state === 'done' || isLoading) return
      await handleUpload()
    },
  }), [handleUpload, isLoading, state])

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border border-paper-200 p-3 dark:border-paper-800 sm:flex-row sm:items-center">
        {!compact && (
          <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded bg-paper-100 text-xs text-ink-500 dark:bg-paper-800 dark:text-ink-200">
            {formatDuration(Math.round(item.video_duration_ms / 1000))}
          </div>
        )}

        <div className="min-w-0 flex-1">
          {!compact && (
            <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-50">{settings.title || item.video_title}</p>
          )}
          <div className={`${compact ? 'mt-0' : 'mt-1'} flex flex-wrap items-center gap-1.5`}>
            {lang && <LanguageBadge code={item.language_code} />}
            <Badge variant={snapshot.targetAssetKind === 'original_video' ? 'info' : 'brand'}>
              {uploadKindLabel}
            </Badge>
            {videoId && (
              <a
                href={`https://youtube.com/watch?v=${videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-clay-600 hover:underline dark:text-clay-300"
              >
                <ExternalLink className="h-3 w-3" />
                {t('app.app.uploads.page.watchOnYouTube')}
              </a>
            )}
          </div>
        </div>

        <div className="shrink-0 sm:ml-auto">
          {state === 'done' ? (
            <Badge variant="success">
              <CheckCircle2 className="h-3 w-3" />
              {t('app.app.uploads.page.uploaded')}
            </Badge>
          ) : isLoading ? (
            <div className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-200">
              <Loader2 className="h-4 w-4 animate-spin" />
              {loadingLabel}
            </div>
          ) : (
            <Button size="sm" onClick={handleOpenModal} disabled={isLoading} className="w-full whitespace-nowrap sm:w-auto">
              <Settings2 className="h-3.5 w-3.5" />
              {t('app.app.uploads.page.uploadToYouTube')}
            </Button>
          )}
        </div>
      </div>

      <UploadSettingsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        settings={settings}
        onChange={setSettings}
        onConfirm={handleUpload}
        isLoading={isLoading}
        langName={langName}
        previewSource={previewSource}
        previewLoading={previewLoading}
        captionUploadFlow={captionUploadFlow}
        uploadsOriginalVideo={uploadsOriginalVideo}
      />
    </>
  )
})

function uploadRowKey(item: CompletedJobLanguage) {
  return `${item.job_id}-${item.language_code}`
}

function EmbeddedUploadJobCard({ job, userId }: { job: CompletedJobGroup; userId: string }) {
  const locale = useAppLocale()
  const rowRefs = useRef<Record<string, UploadRowHandle | null>>({})
  const [bulkUploading, setBulkUploading] = useState(false)
  const pendingItems = job.langs.filter((item) => !item.youtube_video_id)
  const thumbnailUrl = toAssetUrl(job.thumbnail)
  const hasPending = pendingItems.length > 0
  const uploadAllLabel = locale === 'ko' ? '모두 업로드' : 'Upload all'
  const uploadingLabel = locale === 'ko' ? '업로드 중' : 'Uploading'

  const handleUploadAll = useCallback(async () => {
    if (!hasPending || bulkUploading) return
    setBulkUploading(true)
    try {
      for (const item of pendingItems) {
        await rowRefs.current[uploadRowKey(item)]?.upload()
      }
    } finally {
      setBulkUploading(false)
    }
  }, [bulkUploading, hasPending, pendingItems])

  return (
    <div className="rounded-lg border border-paper-200 bg-paper-50 p-4 transition-colors hover:bg-paper-100/70 dark:border-paper-800 dark:bg-paper-900 dark:hover:bg-paper-800/55">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-md bg-paper-100 dark:bg-paper-800 sm:h-20 sm:w-32">
          {thumbnailUrl ? (
            <NextImage
              src={thumbnailUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 128px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-paper-500 dark:text-paper-300">
              <Video className="h-6 w-6" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <Badge variant="warning">{locale === 'ko' ? '업로드 대기' : 'Upload pending'}</Badge>
              <h3 className="mt-2 truncate text-base font-semibold text-ink-900 dark:text-ink-50">
                {job.title}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500 dark:text-ink-200">
                <span>{formatDuration(Math.round(job.durationMs / 1000))}</span>
                <span>{new Date(job.createdAt).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US')}</span>
              </div>
            </div>

            <Button
              size="sm"
              onClick={handleUploadAll}
              disabled={!hasPending || bulkUploading || !userId}
              className="w-full whitespace-nowrap sm:w-auto"
            >
              {bulkUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {bulkUploading ? uploadingLabel : uploadAllLabel}
            </Button>
          </div>

          <div className="mt-4 space-y-2 border-t border-paper-200 pt-3 dark:border-paper-800">
            {job.langs.map((item) => (
              <UploadRow
                key={uploadRowKey(item)}
                ref={(row) => {
                  rowRefs.current[uploadRowKey(item)] = row
                }}
                item={item}
                userId={userId}
                compact
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface UploadsPageProps {
  embedded?: boolean
}

export function UploadsPage({ embedded = false }: UploadsPageProps = {}) {
  const t = useLocaleText()
  const locale = useAppLocale()
  const user = useAuthStore((s) => s.user)
  const { data: items = [], isLoading } = useQuery<CompletedJobLanguage[]>({
    queryKey: ['completed-languages', user?.uid, locale],
    queryFn: () => fetchCompletedLanguages(user!.uid, t),
    enabled: !!user,
    staleTime: 60_000,
  })

  const jobs = Array.from(items.reduce<Map<number, CompletedJobGroup>>((acc, item) => {
    const lang = getLanguageByCode(item.language_code)
    const langName = (locale === 'ko' ? lang?.nativeName : lang?.name) || lang?.name || item.language_code
    const displayTitle = buildSettingsFromSnapshot(resolveSnapshot(item, langName, t), item.video_thumbnail).title || item.video_title
    const existing = acc.get(item.job_id)
    if (!existing) {
      acc.set(item.job_id, {
        id: item.job_id,
        title: displayTitle,
        durationMs: item.video_duration_ms,
        createdAt: item.created_at,
        thumbnail: item.video_thumbnail,
        langs: [item],
      })
      return acc
    }
    existing.langs.push(item)
    return acc
  }, new Map()).values())

  return (
    <div className={embedded ? 'space-y-3' : 'space-y-6'}>
      {!embedded && (
        <PageHeader
          title={t('app.app.uploads.page.youTubeUploads')}
          description={t('app.app.uploads.page.uploadCompletedDubbingResultsToYouTube')}
        />
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-ink-500 dark:text-ink-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{t('app.app.uploads.page.loading')}</span>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Video className="h-12 w-12" />}
          title={t('app.app.uploads.page.noVideosToUpload')}
          description={t('app.app.uploads.page.completedDubbedVideosWillAppearHere')}
        />
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            if (embedded) {
              return <EmbeddedUploadJobCard key={job.id} job={job} userId={user?.uid || ''} />
            }

            return (
              <Card key={job.id}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{job.title}</CardTitle>
                    <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-200">
                      {formatDuration(Math.round(job.durationMs / 1000))} · {new Date(job.createdAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <Badge variant="success">{t('app.app.uploads.page.valueLanguages', { jobLangsLength: job.langs.length })}</Badge>
                </div>
                <div className="space-y-2">
                  {job.langs.map((item) => (
                    <UploadRow key={`${item.job_id}-${item.language_code}`} item={item} userId={user?.uid || ''} />
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default UploadsPage
