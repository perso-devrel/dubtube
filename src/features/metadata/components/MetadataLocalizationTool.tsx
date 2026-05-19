'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, CalendarClock, Check, FileVideo, Image, Languages, ListPlus, Loader2, RefreshCw, Search, ShieldCheck, Sparkles, Tag, Upload } from 'lucide-react'
import { Badge, Button, Card, CardTitle, Input, Modal, Select, Toggle } from '@/components/ui'
import { isYouTubeConnectionError, useChannelStats, useMyVideos } from '@/hooks/useYouTubeData'
import { translateMetadata } from '@/lib/api-client/translate'
import {
  ytFetchVideoMetadata,
  ytUpdateVideoLocalizations,
  ytUploadVideo,
} from '@/lib/api-client/youtube'
import type { MetadataTranslation } from '@/lib/api-client/translate'
import {
  getMarketLanguagePreset,
  getMetadataTargetLanguageCodes,
  METADATA_TARGET_PRESET_OPTIONS,
} from '@/lib/i18n/config'
import { useAppLocale, useLocaleText } from '@/hooks/useLocaleText'
import { useLocaleRouter } from '@/hooks/useLocalePath'
import { useI18nStore } from '@/stores/i18nStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { useYouTubeSettingsStore } from '@/stores/youtubeSettingsStore'
import type { PrivacyStatus } from '@/features/dubbing/types/dubbing.types'
import { SUPPORTED_LANGUAGES, fromBcp47, getLanguageByCode, toBcp47 } from '@/utils/languages'
import { cn } from '@/utils/cn'
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
  getYouTubeCategoryOptions,
  parsePlaylistIds,
} from '@/lib/youtube/upload-options'

type Mode = 'new' | 'existing'

function buildInitialTargets(
  presetId: string,
  customLanguageCodes: readonly string[],
  sourceLang: string,
  exclude: Set<string> = new Set(),
) {
  return getMetadataTargetLanguageCodes(presetId, customLanguageCodes)
    .filter((code) => code !== sourceLang && !exclude.has(code))
}

function parseTagsInput(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function MetadataLocalizationTool() {
  const addToast = useNotificationStore((state) => state.addToast)
  const {
    metadataTargetPreset,
    metadataTargetLanguages,
    setMetadataTargetPreset,
    setMetadataTargetLanguages,
  } = useI18nStore()
  const appLocale = useAppLocale()
  const t = useLocaleText()
  const router = useLocaleRouter()
  const isEnglish = appLocale === 'en'
  const languageOptions = SUPPORTED_LANGUAGES.map((language) => ({
    value: language.code,
    label: isEnglish
      ? `${language.flag} ${language.name} (${language.nativeName})`
      : `${language.flag} ${language.nativeName} (${language.name})`,
  }))
  const presetOptions = METADATA_TARGET_PRESET_OPTIONS.map((preset) => ({
    value: preset.id,
    label: t(preset.labelKey),
  }))
  const categoryOptions = getYouTubeCategoryOptions(appLocale)
  const { defaultLanguage, defaultTags, defaultPrivacy } = useYouTubeSettingsStore()

  const [mode, setMode] = useState<Mode>('existing')
  const [videosLoaded, setVideosLoaded] = useState(false)
  const [requestingVideos, setRequestingVideos] = useState(false)
  const {
    data: videos = [],
    isLoading: loadingVideos,
    isFetching: fetchingVideos,
    error: videosError,
    refetch: refetchVideos,
  } = useMyVideos(50, false)
  const videosBusy = loadingVideos || fetchingVideos || requestingVideos
  const [videoId, setVideoId] = useState('')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  /** 내 영상 모드에서 "불러오기"가 한 번이라도 성공했는지 — 하단 번역 카드 노출 게이트. */
  const [metadataLoaded, setMetadataLoaded] = useState(false)
  const [sourceLang, setSourceLang] = useState(defaultLanguage)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>(() => [...defaultTags])
  // 입력 도중엔 원시 문자열을 유지해 콤마/공백을 자유롭게 입력 가능.
  // blur 시점에만 배열로 정규화한다.
  const [tagsInput, setTagsInput] = useState(() => defaultTags.join(', '))
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setTagsInput(tags.join(', '))
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [tags])
  const commitTags = () => {
    const parsed = parseTagsInput(tagsInput)
    setTags(parsed)
  }
  const [targetLangs, setTargetLangs] = useState<string[]>(
    () => buildInitialTargets(metadataTargetPreset, metadataTargetLanguages, defaultLanguage),
  )
  const [translations, setTranslations] = useState<Record<string, MetadataTranslation>>({})
  /** 내 영상 모드에서 YouTube로부터 가져온 기존 localization 언어 코드 (Perso 코드 기준). */
  const [existingLocalizationLangs, setExistingLocalizationLangs] = useState<Set<string>>(new Set())
  const [loadingMetadata, setLoadingMetadata] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [query, setQuery] = useState('')

  // 새 영상 업로드 확인 모달 상태. 채널·태그·대상 언어는 읽기전용으로 보여주고,
  // 업로드 전 YouTube 업로드 옵션을 모달에서 한 번 더 확정한다.
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadPrivacy, setUploadPrivacy] = useState<PrivacyStatus>(defaultPrivacy)
  const [uploadCategoryId, setUploadCategoryId] = useState(DEFAULT_YOUTUBE_CATEGORY_ID)
  const [uploadPublishAt, setUploadPublishAt] = useState<string | null>(null)
  const [uploadPublishAtTimeZone, setUploadPublishAtTimeZone] = useState(getDefaultPublishTimeZone)
  const [uploadNotifySubscribers, setUploadNotifySubscribers] = useState(true)
  const [uploadThumbnailUrl, setUploadThumbnailUrl] = useState('')
  const [uploadThumbnailFile, setUploadThumbnailFile] = useState<File | null>(null)
  const [uploadPlaylistIdsInput, setUploadPlaylistIdsInput] = useState('')
  const [uploadMadeForKids, setUploadMadeForKids] = useState(false)
  const [uploadContainsSyntheticMedia, setUploadContainsSyntheticMedia] = useState(false)
  const [uploadConfirmed, setUploadConfirmed] = useState(false)
  const { data: channel } = useChannelStats(mode === 'new' && showUploadModal)

  const publishAtTimeZone = normalizePublishTimeZone(uploadPublishAtTimeZone)
  const uploadHasPublishSchedule = hasScheduledPublish(uploadPublishAt)
  const uploadVisibilityValue = effectivePrivacyStatus(uploadPrivacy, uploadPublishAt)
  const uploadScheduleInvalid = uploadHasPublishSchedule && !isFuturePublishAt(uploadPublishAt)
  const uploadTagsPreview = parseTagsInput(tagsInput)
  const uploadText = {
    category: isEnglish ? 'YouTube category' : 'YouTube \uce74\ud14c\uace0\ub9ac',
    thumbnailUrl: isEnglish ? 'Thumbnail image URL' : '\uc378\ub124\uc77c \uc774\ubbf8\uc9c0 URL',
    thumbnailFile: isEnglish ? 'Thumbnail file' : '\uc378\ub124\uc77c \ud30c\uc77c',
    thumbnailPlaceholder: 'https://.../thumbnail.png',
    playlists: isEnglish ? 'Playlist IDs to add' : '\ucd94\uac00\ud560 \ud50c\ub808\uc774\ub9ac\uc2a4\ud2b8 ID',
    playlistsPlaceholder: isEnglish ? 'PL..., UU... separated by commas' : 'PL..., UU... \uc27c\ud45c\ub85c \uad6c\ubd84',
    notifySubscribers: isEnglish ? 'Notify subscribers' : '\uad6c\ub3c5\uc790\uc5d0\uac8c \uc54c\ub9bc \ubcf4\ub0b4\uae30',
    schedulePublish: isEnglish ? 'Schedule publish' : '\uc608\uc57d \uacf5\uac1c',
    scheduleDescription: isEnglish
      ? 'Upload as private first, then publish at the selected time.'
      : '\uba3c\uc800 \ube44\uacf5\uac1c\ub85c \uc5c5\ub85c\ub4dc\ud55c \ub4a4 \uc120\ud0dd\ud55c \uc2dc\uac04\uc5d0 \uacf5\uac1c\ud569\ub2c8\ub2e4.',
    publishTimeZone: isEnglish ? 'Time zone' : '\uae30\uc900 \uc2dc\uac04\ub300',
    publishTimeMustBeFuture: isEnglish ? 'Scheduled publish time must be in the future.' : '\uc608\uc57d \uacf5\uac1c \uc2dc\uac04\uc740 \ud604\uc7ac \uc774\ud6c4\uc5ec\uc57c \ud569\ub2c8\ub2e4.',
    scheduledPrivate: isEnglish ? 'Scheduled uploads stay private until publish time.' : '\uc608\uc57d \uacf5\uac1c \uc601\uc0c1\uc740 \uacf5\uac1c \uc804\uae4c\uc9c0 \ube44\uacf5\uac1c\ub85c \uc5c5\ub85c\ub4dc\ub429\ub2c8\ub2e4.',
    uploadOptions: isEnglish ? 'Category, thumbnail, and playlists' : '\uce74\ud14c\uace0\ub9ac, \uc378\ub124\uc77c, \ud50c\ub808\uc774\ub9ac\uc2a4\ud2b8',
    syntheticMedia: isEnglish ? 'Synthetic or altered media' : '\ud569\uc131 \ub610\ub294 \ubcc0\ud615 \ubbf8\ub514\uc5b4',
    syntheticMediaDescription: isEnglish
      ? 'Mark this when the uploaded video contains realistic synthetic or altered content.'
      : '\uc5c5\ub85c\ub4dc\ud560 \uc601\uc0c1\uc5d0 \uc0ac\uc2e4\uc801\uc778 \ud569\uc131 \ub610\ub294 \ubcc0\ud615 \ucf58\ud150\uce20\uac00 \uc788\uc744 \ub54c \ucf1c\uc138\uc694.',
  }

  const openUploadModal = () => {
    // 모달 열 때마다 최신 store 값을 가져와 초기화 — 별도의 sync effect 불필요.
    setTags(parseTagsInput(tagsInput))
    setUploadPrivacy(defaultPrivacy)
    setUploadCategoryId(DEFAULT_YOUTUBE_CATEGORY_ID)
    setUploadPublishAt(null)
    setUploadPublishAtTimeZone(getDefaultPublishTimeZone())
    setUploadNotifySubscribers(true)
    setUploadThumbnailUrl('')
    setUploadThumbnailFile(null)
    setUploadPlaylistIdsInput('')
    setUploadMadeForKids(false)
    setUploadContainsSyntheticMedia(false)
    setUploadConfirmed(false)
    setShowUploadModal(true)
  }
  const closeUploadModal = () => setShowUploadModal(false)

  const handlePublishAtChange = (value: string) => {
    const publishAt = fromDateTimeLocalInputValue(value, publishAtTimeZone)
    setUploadPublishAt(publishAt)
    if (publishAt) setUploadPrivacy('private')
  }

  const handlePublishScheduleToggle = () => {
    if (uploadHasPublishSchedule) {
      setUploadPublishAt(null)
      return
    }

    setUploadPublishAt(fromDateTimeLocalInputValue(minDateTimeLocalInputValue(1, publishAtTimeZone), publishAtTimeZone))
    setUploadPrivacy('private')
  }

  const handlePublishAtTimeZoneChange = (timeZone: string) => {
    const nextTimeZone = normalizePublishTimeZone(timeZone)
    const localValue = toDateTimeLocalInputValue(uploadPublishAt, publishAtTimeZone)
    setUploadPublishAtTimeZone(nextTimeZone)
    setUploadPublishAt(localValue ? fromDateTimeLocalInputValue(localValue, nextTimeZone) : uploadPublishAt)
  }

  useEffect(() => {
    if (!videosError) return
    console.error('[MetadataLocalizationTool] Failed to load YouTube videos', videosError)
  }, [videosError])

  const handleLoadVideos = async () => {
    setRequestingVideos(true)
    try {
      const result = await refetchVideos()
      if (result.error) throw result.error
      setVideosLoaded(true)
    } catch (err) {
      if (isYouTubeConnectionError(err)) {
        router.push('/settings?section=youtube')
        return
      }
      console.error('[MetadataLocalizationTool] Failed to request YouTube videos permission', err)
      addToast({
        type: 'error',
        title: t('features.metadata.components.metadataLocalizationTool.failedToLoadTitleAndDescription'),
        message: t('features.metadata.components.metadataLocalizationTool.couldNotLoadYouTubeVideosPleaseTryAgain'),
      })
    } finally {
      setRequestingVideos(false)
    }
  }

  const filteredVideos = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return videos
    return videos.filter((video) => video.title.toLowerCase().includes(q))
  }, [query, videos])

  const selectedPreset = getMarketLanguagePreset(metadataTargetPreset)
  const targetSet = new Set(targetLangs)
  const canTranslate = title.trim().length > 0 && targetLangs.length > 0
  const canApply = mode === 'existing' && videoId && title.trim().length > 0 && Object.keys(translations).length > 0
  const canUpload = mode === 'new' && videoFile && title.trim().length > 0 && Object.keys(translations).length > 0
  /**
   * 사용자가 선택한 대상 언어 모두에 대해 번역(title 채워짐)이 준비됐는지.
   * 이 값이 true면 "업로드/적용" 버튼만, false면 "번역 생성" 버튼만 노출한다.
   * 사용자가 새 언어를 추가하면 자연스럽게 false가 되어 다시 번역 생성으로 돌아간다.
   */
  const allTargetsTranslated =
    targetLangs.length > 0 &&
    targetLangs.every((code) => translations[code]?.title?.trim().length)

  const switchMode = (next: Mode) => {
    if (next === mode) return
    setMode(next)
    setVideoId('')
    setVideoFile(null)
    setTitle('')
    setDescription('')
    setTags([...defaultTags])
    setTranslations({})
    setExistingLocalizationLangs(new Set())
    setMetadataLoaded(false)
    setTargetLangs(buildInitialTargets(metadataTargetPreset, metadataTargetLanguages, sourceLang))
  }

  const handleLoadMetadata = async () => {
    if (!videoId) return
    setLoadingMetadata(true)
    try {
      const requestedSourceLang = toBcp47(sourceLang || defaultLanguage)
      const metadata = await ytFetchVideoMetadata(videoId, requestedSourceLang)
      setTitle(metadata.title)
      setDescription(metadata.description)
      // YouTube에 defaultLanguage가 명시되어 있지 않으면 빈 문자열이 옴 — 사용자 설정 기본값으로 fallback.
      const ytDefaultLang = metadata.defaultLanguage?.trim() ?? ''
      const ytResolvedLang = metadata.resolvedLanguage?.trim() ?? ''
      const nextSourceLang = ytResolvedLang
        ? fromBcp47(ytResolvedLang)
        : ytDefaultLang ? fromBcp47(ytDefaultLang) : defaultLanguage
      setSourceLang(nextSourceLang)
      if (!ytDefaultLang && !ytResolvedLang) {
        addToast({
          type: 'warning',
        title: t('features.metadata.components.metadataLocalizationTool.theSourceLanguageIsNotSetOnYouTube'),
        message: t('features.metadata.components.metadataLocalizationTool.usingYourDefaultLanguageValueIfThisIs', { nextSourceLang: nextSourceLang }),
        })
      }

      // YouTube의 localizations은 BCP-47 키. 내부에서는 Perso 코드로 표준화.
      const existingPersoCodes = new Set(
        Object.keys(metadata.localizations).map((bcp47) => fromBcp47(bcp47)),
      )
      setExistingLocalizationLangs(existingPersoCodes)

      const normalizedTranslations = Object.fromEntries(
        Object.entries(metadata.localizations).map(([bcp47, value]) => [
          fromBcp47(bcp47),
          value,
        ]),
      )
      setTranslations(normalizedTranslations)

      // 이미 번역된 언어는 picker 기본 선택에서 제외 — 사용자는 추가하고 싶은 것만 선택.
      setTargetLangs(buildInitialTargets(metadataTargetPreset, metadataTargetLanguages, nextSourceLang, existingPersoCodes))
      setMetadataLoaded(true)

      addToast({ type: 'success', title: t('features.metadata.components.metadataLocalizationTool.loadedYouTubeTitleAndDescription') })
    } catch (err) {
      console.error('[MetadataLocalizationTool] Failed to load YouTube metadata', err)
      addToast({
        type: 'error',
        title: t('features.metadata.components.metadataLocalizationTool.failedToLoadTitleAndDescription'),
        message: t('features.metadata.components.metadataLocalizationTool.couldNotLoadTheYouTubeTitleAndDescription'),
      })
    } finally {
      setLoadingMetadata(false)
    }
  }

  const handleTranslate = async () => {
    if (!canTranslate) return
    setTranslating(true)
    try {
      const result = await translateMetadata({
        title: title.trim(),
        description,
        sourceLang,
        targetLangs,
      })
      setTranslations((prev) => ({ ...prev, ...result }))
      addToast({ type: 'success', title: t('features.metadata.components.metadataLocalizationTool.titleAndDescriptionTranslationsGenerated') })
    } catch (err) {
      console.error('[MetadataLocalizationTool] Failed to translate metadata', err)
      addToast({
        type: 'error',
        title: t('features.metadata.components.metadataLocalizationTool.translationFailed'),
        message: t('features.metadata.components.metadataLocalizationTool.couldNotGenerateTranslationsPleaseTryAgainShortly'),
      })
    } finally {
      setTranslating(false)
    }
  }

  const handleApply = async () => {
    if (!canApply) return
    setSaving(true)
    try {
      const localizations = Object.fromEntries(
        Object.entries(translations).map(([code, value]) => [toBcp47(code), value]),
      )
      await ytUpdateVideoLocalizations({
        videoId,
        sourceLang: toBcp47(sourceLang),
        title: title.trim(),
        description,
        localizations,
      })
      addToast({ type: 'success', title: t('features.metadata.components.metadataLocalizationTool.appliedYouTubeTitleAndDescriptionTranslations') })
    } catch (err) {
      console.error('[MetadataLocalizationTool] Failed to apply YouTube metadata', err)
      addToast({
        type: 'error',
        title: t('features.metadata.components.metadataLocalizationTool.failedToApplyChangesOnYouTube'),
        message: t('features.metadata.components.metadataLocalizationTool.couldNotApplyChangesToYouTubePleaseTry'),
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUploadNew = async () => {
    if (!canUpload || !videoFile) return
    setUploading(true)
    try {
      const uploadTags = parseTagsInput(tagsInput)
      const uploadPrivacyStatus = effectivePrivacyStatus(uploadPrivacy, uploadPublishAt)
      const localizations = Object.fromEntries(
        Object.entries(translations).map(([code, value]) => [toBcp47(code), value]),
      )
      await ytUploadVideo({
        video: videoFile,
        title: title.trim(),
        description,
        tags: uploadTags,
        categoryId: uploadCategoryId,
        privacyStatus: uploadPrivacyStatus,
        publishAt: uploadPublishAt,
        notifySubscribers: uploadNotifySubscribers,
        thumbnail: uploadThumbnailFile,
        thumbnailUrl: uploadThumbnailUrl,
        playlistIds: parsePlaylistIds(uploadPlaylistIdsInput),
        selfDeclaredMadeForKids: uploadMadeForKids,
        containsSyntheticMedia: uploadContainsSyntheticMedia,
        language: toBcp47(sourceLang),
        localizations,
      })
      const privacyLabel =
        uploadPrivacyStatus === 'public' ? t('features.metadata.components.metadataLocalizationTool.public')
          : uploadPrivacyStatus === 'unlisted' ? t('features.metadata.components.metadataLocalizationTool.unlisted')
            : t('features.metadata.components.metadataLocalizationTool.private')
      const publishLabel = uploadPublishAt
        ? new Date(uploadPublishAt).toLocaleString(isEnglish ? 'en-US' : 'ko-KR')
        : null
      addToast({
        type: 'success',
        title: t('features.metadata.components.metadataLocalizationTool.youTubeUploadComplete'),
        message: publishLabel
          ? (isEnglish ? `Scheduled for ${publishLabel}.` : `${publishLabel} \uc608\uc57d \uacf5\uac1c`)
          : t('features.metadata.components.metadataLocalizationTool.videoUploadedAsValue', { privacyLabel: privacyLabel }),
      })
      // 업로드 후 폼 초기화 — 같은 파일 중복 업로드 방지.
      setVideoFile(null)
      setTitle('')
      setDescription('')
      setTags([...defaultTags])
      setTranslations({})
      setUploadThumbnailFile(null)
      setShowUploadModal(false)
    } catch (err) {
      console.error('[MetadataLocalizationTool] Failed to upload YouTube video', err)
      addToast({
        type: 'error',
        title: t('features.metadata.components.metadataLocalizationTool.youTubeUploadFailed'),
        message: t('features.metadata.components.metadataLocalizationTool.couldNotCompleteTheYouTubeUploadCheckThe'),
      })
    } finally {
      setUploading(false)
    }
  }

  const toggleTarget = (code: string) => {
    if (code === sourceLang) return
    if (mode === 'existing' && existingLocalizationLangs.has(code)) return
    setTargetLangs((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    )
  }

  const updateTranslation = (
    code: string,
    patch: Partial<MetadataTranslation>,
  ) => {
    setTranslations((current) => ({
      ...current,
      [code]: {
        title: current[code]?.title ?? '',
        description: current[code]?.description ?? '',
        ...patch,
      },
    }))
  }

  return (
    <div className="space-y-6">
      {/* 모드 토글 */}
      <div className="flex gap-1 rounded-lg bg-paper-100 p-1 dark:bg-paper-800" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'new'}
          onClick={() => switchMode('new')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-ring',
            mode === 'new'
              ? 'bg-paper-50 text-ink-900 shadow-sm dark:bg-paper-700 dark:text-ink-50'
              : 'text-ink-500 hover:text-ink-700 dark:text-ink-200 dark:hover:text-ink-50',
          )}
        >
          <FileVideo className="h-4 w-4" />
          {t('features.metadata.components.metadataLocalizationTool.uploadAndLocalizeNewVideo')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'existing'}
          onClick={() => switchMode('existing')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-ring',
            mode === 'existing'
              ? 'bg-paper-50 text-ink-900 shadow-sm dark:bg-paper-700 dark:text-ink-50'
              : 'text-ink-500 hover:text-ink-700 dark:text-ink-200 dark:hover:text-ink-50',
          )}
        >
          <RefreshCw className="h-4 w-4" />
          {t('features.metadata.components.metadataLocalizationTool.useExistingVideo')}
        </button>
      </div>

      {mode === 'existing' ? (
        <Card>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <CardTitle>{t('features.metadata.components.metadataLocalizationTool.selectAYouTubeVideo')}</CardTitle>
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-200">
                {t('features.metadata.components.metadataLocalizationTool.loadTheTitleDescriptionAndExistingTranslationsFor')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadVideos}
              loading={videosBusy}
              disabled={videosBusy}
            >
              {videosBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t('features.metadata.components.metadataLocalizationTool.useExistingVideo')}
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-paper-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('features.metadata.components.metadataLocalizationTool.searchByVideoTitle')}
                  className="h-10 w-full rounded-lg border border-paper-300 bg-paper-50 pl-9 pr-3 text-sm text-ink-900 focus:border-clay-500 focus:outline-none focus:ring-1 focus:ring-clay-500 dark:border-paper-700 dark:bg-paper-800 dark:text-ink-50"
                />
              </div>
              <Select
                label={t('features.metadata.components.metadataLocalizationTool.targetVideo')}
                value={videoId}
                disabled={!videosLoaded || videosBusy}
                onChange={(event) => {
                  const selected = videos.find((video) => video.videoId === event.target.value)
                  setVideoId(event.target.value)
                  // 다른 영상으로 바꾸면 이전 로드 결과는 무효 — 다시 "불러오기" 눌러야 함.
                  setMetadataLoaded(false)
                  setTitle('')
                  setDescription('')
                  setTranslations({})
                  setExistingLocalizationLangs(new Set())
                  if (selected) setTitle(selected.title)
                }}
                options={[
                  { value: '', label: videosBusy ? t('features.metadata.components.metadataLocalizationTool.loading') : t('features.metadata.components.metadataLocalizationTool.selectAVideo') },
                  ...filteredVideos.map((video) => ({
                    value: video.videoId,
                    label: `${video.title} (${video.privacyStatus})`,
                  })),
                ]}
              />
              {videosError && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {t('features.metadata.components.metadataLocalizationTool.couldNotLoadYouTubeVideosPleaseTryAgain')}
                </p>
              )}
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={handleLoadMetadata}
                loading={loadingMetadata}
                disabled={!videoId || loadingMetadata}
                className="w-full md:w-auto"
              >
                <RefreshCw className="h-4 w-4" />
                {t('features.metadata.components.metadataLocalizationTool.load')}
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="mb-5">
            <CardTitle>{t('features.metadata.components.metadataLocalizationTool.selectAVideoFile')}</CardTitle>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-200">
              {t('features.metadata.components.metadataLocalizationTool.selectAVideoFileToUploadMultilingualTitles')}
            </p>
          </div>

          <label
            htmlFor="metadata-new-video-file"
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
              videoFile
                ? 'border-clay-300 bg-clay-50 dark:border-clay-700 dark:bg-clay-800/20'
                : 'border-paper-300 hover:border-clay-300 hover:bg-paper-100 dark:border-paper-700 dark:hover:border-clay-700 dark:hover:bg-paper-800',
            )}
          >
            <FileVideo className="h-8 w-8 text-paper-400" />
            {videoFile ? (
              <>
                <span className="text-sm font-medium text-ink-900 dark:text-ink-50">
                  {videoFile.name}
                </span>
                <span className="text-xs text-ink-500 dark:text-ink-200">
                  {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              </>
            ) : (
              <>
                <span className="text-sm font-medium text-ink-600 dark:text-ink-100">
                  {t('features.metadata.components.metadataLocalizationTool.selectAVideoFile2')}
                </span>
                <span className="text-xs text-ink-500 dark:text-ink-200">
                  {t('features.metadata.components.metadataLocalizationTool.videoFormatsSupportedByYouTubeSuchAsMp4')}
                </span>
              </>
            )}
            <input
              id="metadata-new-video-file"
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                setVideoFile(file)
              }}
            />
          </label>
          <p className="mt-3 text-xs text-ink-500 dark:text-ink-200">
            {t('features.metadata.components.metadataLocalizationTool.videosAreUploadedAsPrivateByDefaultReview')}
          </p>
        </Card>
      )}

      {((mode === 'existing' && metadataLoaded) || (mode === 'new' && videoFile)) && (
      <Card>
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-clay-50 text-clay-600 dark:bg-clay-800/20 dark:text-clay-200">
            <Languages className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>{t('features.metadata.components.metadataLocalizationTool.titleAndDescriptionTranslation')}</CardTitle>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-200">
              {mode === 'new'
                ? t('features.metadata.components.metadataLocalizationTool.generateTranslatedTitlesAndDescriptionsForUpload')
                : t('features.metadata.components.metadataLocalizationTool.generateTranslationsForYouTubeMultilingualTitlesAndDescriptions')}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label={t('features.metadata.components.metadataLocalizationTool.sourceLanguage')}
            value={sourceLang}
            onChange={(event) => {
              const nextSourceLang = event.target.value
              setSourceLang(nextSourceLang)
              setTargetLangs(buildInitialTargets(metadataTargetPreset, metadataTargetLanguages, nextSourceLang, existingLocalizationLangs))
            }}
            options={languageOptions}
          />
          <Select
            label={t('features.metadata.components.metadataLocalizationTool.recommendedLanguageSet')}
            value={metadataTargetPreset}
            onChange={(event) => {
              const nextPreset = event.target.value
              const nextTargetLanguages = getMetadataTargetLanguageCodes(nextPreset, metadataTargetLanguages)
              setMetadataTargetPreset(nextPreset)
              setMetadataTargetLanguages(nextTargetLanguages)
              setTargetLangs(buildInitialTargets(nextPreset, nextTargetLanguages, sourceLang, existingLocalizationLangs))
            }}
            options={presetOptions}
          />
        </div>

        <div className="mt-4 space-y-4">
          <Input
            label={t('features.metadata.components.metadataLocalizationTool.sourceTitle')}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('features.metadata.components.metadataLocalizationTool.youTubeTitle')}
          />
          <div>
            <label htmlFor="metadata-source-description" className="mb-1.5 block text-sm font-medium text-ink-600 dark:text-ink-200">
              {t('features.metadata.components.metadataLocalizationTool.sourceDescription')}
            </label>
            <textarea
              id="metadata-source-description"
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('features.metadata.components.metadataLocalizationTool.youTubeDescription')}
              className="w-full resize-none rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-500 transition-colors focus-ring dark:border-paper-700 dark:bg-paper-800 dark:text-ink-50 dark:placeholder:text-paper-400"
            />
          </div>
          {mode === 'new' && (
            <div>
              <Input
                label={t('features.metadata.components.metadataLocalizationTool.tags')}
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                onBlur={commitTags}
                placeholder={t('features.metadata.components.metadataLocalizationTool.commaSeparatedEGGamingVlog')}
              />
              <p className="mt-1.5 text-xs text-ink-500 dark:text-ink-200">
                {t('features.metadata.components.metadataLocalizationTool.defaultTagsAreAppliedChangeThemForThis')}
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-lg bg-paper-100 p-3 dark:bg-paper-800/60">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink-700 dark:text-ink-50">
                {t(selectedPreset.labelKey)}
              </p>
              <p className="text-xs text-ink-500 dark:text-ink-200">
                {t(selectedPreset.descriptionKey)}
              </p>
            </div>
            <Badge variant="brand">{t('features.metadata.components.metadataLocalizationTool.valueSelected', { targetLangsLength: targetLangs.length })}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_LANGUAGES.map((language) => {
              const selected = targetSet.has(language.code)
              const alreadyTranslated = mode === 'existing' && existingLocalizationLangs.has(language.code)
              const disabled = language.code === sourceLang || alreadyTranslated
              return (
                <button
                  key={language.code}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleTarget(language.code)}
                  title={alreadyTranslated ? t('features.metadata.components.metadataLocalizationTool.alreadyTranslated') : undefined}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition',
                    selected
                      ? 'bg-clay-50 text-clay-700 ring-clay-300 dark:bg-clay-800/30 dark:text-clay-200 dark:ring-clay-800'
                      : alreadyTranslated
                        ? 'bg-paper-100 text-ink-500 ring-paper-200 dark:bg-paper-800 dark:text-ink-200 dark:ring-paper-700'
                        : 'bg-paper-50 text-ink-500 ring-paper-200 hover:bg-paper-100 dark:bg-paper-900 dark:text-ink-200 dark:ring-paper-700 dark:hover:bg-paper-800',
                    disabled && 'cursor-not-allowed',
                  )}
                >
                  {selected && <Check className="h-3 w-3" />}
                  {alreadyTranslated && <Check className="h-3 w-3 text-ink-500 dark:text-ink-200" />}
                  {language.flag} {isEnglish ? language.name : language.nativeName}
                </button>
              )
            })}
          </div>
          {mode === 'existing' && existingLocalizationLangs.size > 0 && (
            <p className="mt-2 text-xs text-ink-500 dark:text-ink-200">
              {t('features.metadata.components.metadataLocalizationTool.valueExistingTranslationsCannotBeSelected', { existingLocalizationLangsSize: existingLocalizationLangs.size })}
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {!allTargetsTranslated ? (
            <Button
              onClick={handleTranslate}
              loading={translating}
              disabled={!canTranslate || translating}
            >
              <Languages className="h-4 w-4" />
              {t('features.metadata.components.metadataLocalizationTool.generateTranslations')}
            </Button>
          ) : mode === 'existing' ? (
            <Button
              onClick={handleApply}
              loading={saving}
              disabled={!canApply || saving}
            >
              <Upload className="h-4 w-4" />
              {t('features.metadata.components.metadataLocalizationTool.applyToYouTube')}
            </Button>
          ) : (
            <Button
              onClick={openUploadModal}
              disabled={!canUpload || uploading}
            >
              <Upload className="h-4 w-4" />
              {t('features.metadata.components.metadataLocalizationTool.uploadToYouTube')}
            </Button>
          )}
        </div>
      </Card>
      )}

      {Object.keys(translations).length > 0 && (
        <Card>
          <div className="mb-5">
            <CardTitle>{t('features.metadata.components.metadataLocalizationTool.reviewTranslations')}</CardTitle>
            <p className="mt-1 text-sm text-ink-500 dark:text-paper-400">
              {t('features.metadata.components.metadataLocalizationTool.editTitlesAndDescriptionsBeforeApplyingThem')}
            </p>
          </div>

          <div className="space-y-4">
            {Object.entries(translations).map(([code, value]) => {
              const language = getLanguageByCode(code) ?? getLanguageByCode(code.split('-')[0])
              const isPreExisting = mode === 'existing' && existingLocalizationLangs.has(code)
              return (
                <div key={code} className="rounded-lg border border-paper-200 p-4 dark:border-paper-800">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-lg">{language?.flag}</span>
                    <span className="font-medium text-ink-900 dark:text-ink-50">
                      {language ? (isEnglish ? language.name : language.nativeName) : code}
                    </span>
                    <span className="text-xs text-ink-500 dark:text-paper-400">{toBcp47(code)}</span>
                    {isPreExisting && (
                      <Badge variant="default">{t('features.metadata.components.metadataLocalizationTool.existingYouTubeTranslation')}</Badge>
                    )}
                  </div>
                  <div className="space-y-3">
                    <Input
                      label={t('features.metadata.components.metadataLocalizationTool.title')}
                      value={value.title}
                      onChange={(event) => updateTranslation(code, { title: event.target.value })}
                    />
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-ink-600 dark:text-ink-200">
                        {t('features.metadata.components.metadataLocalizationTool.description')}
                      </label>
                      <textarea
                        rows={4}
                        value={value.description}
                        onChange={(event) => updateTranslation(code, { description: event.target.value })}
                        className="w-full resize-none rounded-lg border border-paper-300 bg-paper-50 px-3 py-2 text-sm text-ink-900 transition-colors focus-ring dark:border-paper-700 dark:bg-paper-800 dark:text-ink-50"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {mode === 'new' && (
        <Modal
          open={showUploadModal}
          onClose={closeUploadModal}
          title={t('features.metadata.components.metadataLocalizationTool.reviewYouTubeUploadSettings')}
          size="lg"
        >
          <div className="space-y-5">
            <div className="rounded-lg border border-paper-200 p-3 dark:border-paper-800">
              <p className="text-xs font-medium text-ink-500 dark:text-paper-400">{t('features.metadata.components.metadataLocalizationTool.channel')}</p>
              <p className="mt-1 text-sm text-ink-900 dark:text-ink-50">
                {channel
                  ? t('features.metadata.components.metadataLocalizationTool.valueValueSubscribers', { channelTitle: channel.title, channelSubscriberCountToLocaleStringKoKR: channel.subscriberCount.toLocaleString('ko-KR'), channelSubscriberCountToLocaleStringEnUS: channel.subscriberCount.toLocaleString('en-US') })
                  : t('features.metadata.components.metadataLocalizationTool.noConnectedChannelInformation')}
              </p>
            </div>

            <div className="rounded-lg border border-paper-200 p-3 dark:border-paper-800">
              <p className="text-xs font-medium text-ink-500 dark:text-paper-400">{t('features.metadata.components.metadataLocalizationTool.targetLanguagesValue', { ObjectKeysTranslationsLength: Object.keys(translations).length })}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.keys(translations).map((code) => {
                  const lang = getLanguageByCode(code) ?? getLanguageByCode(code.split('-')[0])
                  return (
                    <Badge key={code} variant="brand">
                      {lang ? `${lang.flag} ${isEnglish ? lang.name : lang.nativeName}` : code}
                    </Badge>
                  )
                })}
              </div>
            </div>

            <div className="rounded-lg border border-paper-200 p-3 dark:border-paper-800">
              <p className="text-xs font-medium text-ink-500 dark:text-paper-400">{t('features.metadata.components.metadataLocalizationTool.tags2')}</p>
              <p className="mt-1 text-sm text-ink-900 dark:text-ink-50">
                {uploadTagsPreview.length > 0 ? uploadTagsPreview.join(', ') : <span className="text-ink-500 dark:text-paper-400">{t('features.metadata.components.metadataLocalizationTool.none')}</span>}
              </p>
            </div>

            <div className="rounded-lg border border-paper-200 p-3 dark:border-paper-800">
              <div className="mb-3 flex min-w-0 items-start gap-2">
                <Tag className="mt-0.5 h-4 w-4 flex-shrink-0 text-paper-400" />
                <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{uploadText.uploadOptions}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label={uploadText.category}
                  value={uploadCategoryId}
                  onChange={(e) => setUploadCategoryId(e.target.value)}
                  options={categoryOptions}
                />
                <Input
                  label={uploadText.thumbnailUrl}
                  value={uploadThumbnailUrl}
                  onChange={(e) => setUploadThumbnailUrl(e.target.value)}
                  placeholder={uploadText.thumbnailPlaceholder}
                  icon={<Image className="h-4 w-4" />}
                />
                <div className="sm:col-span-2">
                  <Input
                    label={uploadText.playlists}
                    value={uploadPlaylistIdsInput}
                    onChange={(e) => setUploadPlaylistIdsInput(e.target.value)}
                    placeholder={uploadText.playlistsPlaceholder}
                    icon={<ListPlus className="h-4 w-4" />}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-ink-600 dark:text-ink-200">
                    {uploadText.thumbnailFile}
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => setUploadThumbnailFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-md file:border-0 file:bg-paper-200 file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink-600 hover:file:bg-paper-300 dark:text-ink-200 dark:file:bg-paper-700 dark:file:text-ink-50 dark:hover:file:bg-paper-600"
                  />
                </div>
              </div>
            </div>

            <Select
              label={t('features.metadata.components.metadataLocalizationTool.visibility')}
              value={uploadVisibilityValue}
              onChange={(e) => setUploadPrivacy(e.target.value as PrivacyStatus)}
              disabled={uploadHasPublishSchedule}
              options={[
                { value: 'private', label: t('features.metadata.components.metadataLocalizationTool.private2') },
                { value: 'unlisted', label: t('features.metadata.components.metadataLocalizationTool.unlisted2') },
                { value: 'public', label: t('features.metadata.components.metadataLocalizationTool.public2') },
              ]}
            />
            {uploadHasPublishSchedule && (
              <p className="-mt-3 text-xs text-ink-500 dark:text-ink-200">
                {uploadText.scheduledPrivate}
              </p>
            )}
            <p className="-mt-3 text-xs text-ink-500 dark:text-ink-200">
              {t('features.metadata.components.metadataLocalizationTool.theDefaultIsAppliedChangeItForThis')}
            </p>

            <div className="rounded-lg border border-paper-200 p-3 dark:border-paper-800">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <CalendarClock className="mt-0.5 h-4 w-4 flex-shrink-0 text-paper-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{uploadText.schedulePublish}</p>
                    <p className="mt-1 text-xs leading-5 text-ink-500 dark:text-paper-400">{uploadText.scheduleDescription}</p>
                  </div>
                </div>
                <Toggle checked={uploadHasPublishSchedule} onChange={handlePublishScheduleToggle} />
              </div>
              {uploadHasPublishSchedule && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Input
                    type="datetime-local"
                    value={toDateTimeLocalInputValue(uploadPublishAt, publishAtTimeZone)}
                    min={minDateTimeLocalInputValue(1, publishAtTimeZone)}
                    onChange={(e) => handlePublishAtChange(e.target.value)}
                    aria-label={uploadText.schedulePublish}
                  />
                  <Select
                    label={uploadText.publishTimeZone}
                    value={publishAtTimeZone}
                    onChange={(e) => handlePublishAtTimeZoneChange(e.target.value)}
                    options={getSupportedPublishTimeZones().map((timeZone) => ({
                      value: timeZone,
                      label: timeZone.replaceAll('_', ' '),
                    }))}
                  />
                  {uploadScheduleInvalid && (
                    <p className="text-xs text-red-500 sm:col-span-2">
                      {uploadText.publishTimeMustBeFuture}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-paper-200 p-3 dark:border-paper-800">
              <div className="flex min-w-0 items-start gap-2">
                <Bell className="mt-0.5 h-4 w-4 flex-shrink-0 text-paper-400" />
                <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{uploadText.notifySubscribers}</p>
              </div>
              <Toggle checked={uploadNotifySubscribers} onChange={setUploadNotifySubscribers} />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-paper-200 p-3 dark:border-paper-800">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 flex-shrink-0 text-paper-400" />
                  <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{t('features.metadata.components.metadataLocalizationTool.madeForKids')}</p>
                </div>
                <p className="text-xs leading-5 text-ink-500 dark:text-paper-400">{t('features.metadata.components.metadataLocalizationTool.setThisAccordingToYouTubeMadeForKids')}</p>
              </div>
              <Toggle checked={uploadMadeForKids} onChange={setUploadMadeForKids} />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-paper-200 p-3 dark:border-paper-800">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 flex-shrink-0 text-amber-500" />
                  <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{uploadText.syntheticMedia}</p>
                </div>
                <p className="text-xs leading-5 text-ink-500 dark:text-paper-400">{uploadText.syntheticMediaDescription}</p>
              </div>
              <Toggle checked={uploadContainsSyntheticMedia} onChange={setUploadContainsSyntheticMedia} />
            </div>

            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-paper-200 p-3 dark:border-paper-800">
              <input
                type="checkbox"
                checked={uploadConfirmed}
                onChange={(e) => setUploadConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-paper-300 text-clay-600 focus-ring"
              />
              <span className="text-sm leading-6 text-ink-600 dark:text-ink-200">
                {t('features.metadata.components.metadataLocalizationTool.iReviewedTheSettingsAndWantToUpload')}
              </span>
            </label>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={closeUploadModal} disabled={uploading}>
              {t('features.metadata.components.metadataLocalizationTool.cancel')}
            </Button>
            <Button
              onClick={handleUploadNew}
              loading={uploading}
              disabled={!uploadConfirmed || uploading || uploadScheduleInvalid}
            >
              <Upload className="h-4 w-4" />
              {t('features.metadata.components.metadataLocalizationTool.uploadWithTheseSettings')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
