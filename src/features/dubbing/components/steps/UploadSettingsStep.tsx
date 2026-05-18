'use client'

import { type ChangeEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Bell, CalendarClock, Captions, ChevronDown, Image, Languages, Link2, ListPlus, ShieldCheck, Sparkles, Upload } from 'lucide-react'
import { Button, Input, Select } from '@/components/ui'
import { useAppLocale, useLocaleText } from '@/hooks/useLocaleText'
import { extractVideoId } from '@/utils/validators'
import { SUPPORTED_LANGUAGES } from '@/utils/languages'
import { getSasToken, uploadFileToBlob } from '@/lib/api-client'
import {
  effectivePrivacyStatus,
  fromDateTimeLocalInputValue,
  getSupportedPublishTimeZones,
  hasScheduledPublish,
  isFuturePublishAt,
  minDateTimeLocalInputValue,
  normalizePublishTimeZone,
  toDateTimeLocalInputValue,
} from '@/lib/youtube/publish-schedule'
import {
  formatPlaylistIds,
  getYouTubeCategoryOptions,
  parsePlaylistIds,
} from '@/lib/youtube/upload-options'
import { useDubbingStore } from '../../store/dubbingStore'
import { getAiDisclosureText, stripAiDisclosureFooter } from '../../utils/aiDisclosure'
import type { PrivacyStatus } from '../../types/dubbing.types'

export function UploadSettingsStep() {
  const {
    videoMeta,
    videoSource,
    deliverableMode,
    uploadSettings,
    setUploadSettings,
    syncPrivacyFromGlobalDefault,
    syncMetadataLanguageFromGlobalDefault,
    syncTagsFromGlobalDefault,
    prevStep,
    nextStep,
  } = useDubbingStore()
  const locale = useAppLocale()
  const t = useLocaleText()
  const privacyOptions: { value: PrivacyStatus; label: string }[] = [
    { value: 'private', label: t('features.dubbing.components.steps.uploadSettingsStep.privateRecommended') },
    { value: 'unlisted', label: t('features.dubbing.components.steps.uploadSettingsStep.unlisted') },
    { value: 'public', label: t('features.dubbing.components.steps.uploadSettingsStep.public') },
  ]
  const languageOptions = SUPPORTED_LANGUAGES.map((l) => ({
    value: l.code,
    label: locale === 'ko'
      ? `${l.flag} ${l.nativeName} (${l.name})`
      : `${l.flag} ${l.name} (${l.nativeName})`,
  }))
  const categoryOptions = getYouTubeCategoryOptions(locale)
  const uploadOptionText = {
    category: locale === 'ko' ? 'YouTube 카테고리' : 'YouTube category',
    thumbnailUrl: locale === 'ko' ? '썸네일 이미지' : 'Thumbnail image',
    thumbnailPlaceholder: locale === 'ko'
      ? 'https://.../thumbnail.png'
      : 'https://.../thumbnail.png',
    thumbnailUpload: locale === 'ko' ? '이미지 업로드' : 'Upload image',
    thumbnailUploading: locale === 'ko' ? '썸네일 업로드 중' : 'Uploading thumbnail',
    thumbnailHelp: locale === 'ko' ? 'JPEG 또는 PNG, 2MB 이하 이미지를 업로드하거나 URL을 입력하세요.' : 'Upload a JPEG or PNG image up to 2MB, or enter an image URL.',
    thumbnailRemove: locale === 'ko' ? '삭제' : 'Remove',
    thumbnailInvalidType: locale === 'ko' ? '썸네일은 JPEG 또는 PNG 이미지만 사용할 수 있습니다.' : 'Thumbnail must be a JPEG or PNG image.',
    thumbnailTooLarge: locale === 'ko' ? '썸네일 이미지는 2MB 이하여야 합니다.' : 'Thumbnail image must be 2MB or smaller.',
    thumbnailUploadFailed: locale === 'ko' ? '썸네일 이미지를 업로드하지 못했습니다. 다시 시도해 주세요.' : 'Could not upload the thumbnail image. Please try again.',
    playlists: locale === 'ko' ? '추가할 플레이리스트 ID' : 'Playlist IDs to add',
    playlistsPlaceholder: locale === 'ko'
      ? 'PL..., UU... 쉼표로 구분'
      : 'PL..., UU... separated by commas',
    notifySubscribers: locale === 'ko' ? '구독자에게 알림 보내기' : 'Notify subscribers',
    notifySubscribersDescription: locale === 'ko'
      ? 'YouTube 업로드 시 알림 설정을 해둔 구독자들에게 알림이 갑니다.'
      : 'Notify subscribers who have enabled upload notifications when the video is uploaded.',
    postUploadOptions: locale === 'ko'
      ? '카테고리, 썸네일, 플레이리스트'
      : 'Category, thumbnail, and playlists',
  }

  // YouTube 설정 페이지의 기본값과 동기화 (사용자 override 없을 때만).
  useEffect(() => {
    syncPrivacyFromGlobalDefault()
    syncMetadataLanguageFromGlobalDefault()
    syncTagsFromGlobalDefault()
  }, [syncPrivacyFromGlobalDefault, syncMetadataLanguageFromGlobalDefault, syncTagsFromGlobalDefault])

  const originalYouTubeId =
    videoSource?.type === 'url' && videoSource.url ? extractVideoId(videoSource.url) : null
  const originalYouTubeUrl = originalYouTubeId
    ? `https://www.youtube.com/watch?v=${originalYouTubeId}`
    : null
  const aiDisclosureText = getAiDisclosureText(uploadSettings.metadataLanguage)

  useEffect(() => {
    const strippedDescription = stripAiDisclosureFooter(uploadSettings.description)
    if (strippedDescription !== uploadSettings.description) {
      setUploadSettings({ description: strippedDescription })
    }
  }, [uploadSettings.description, setUploadSettings])

  useEffect(() => {
    if (deliverableMode === 'newDubbedVideos' && !uploadSettings.autoUpload && uploadSettings.uploadCaptions) {
      setUploadSettings({ uploadCaptions: false })
    }
  }, [deliverableMode, uploadSettings.autoUpload, uploadSettings.uploadCaptions, setUploadSettings])

  // 영상 정보로 제목/설명을 초기 1회 채워준다. 사용자가 빈 값으로 지웠을 때
  // 다시 채워 넣지 않도록 videoMeta.id 단위로 한 번만 실행. (deps에 입력값을
  // 넣으면 사용자가 지울 때마다 재초기화돼 빈 값이 유지되지 않는다.)
  const initializedForVideoIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!videoMeta?.title) return
    if (initializedForVideoIdRef.current === videoMeta.id) return
    initializedForVideoIdRef.current = videoMeta.id

    const { title, description } = useDubbingStore.getState().uploadSettings
    const patch: Partial<typeof uploadSettings> = {}
    if (!title) patch.title = videoMeta.title
    if (!description) {
      patch.description = videoMeta.description
        ? videoMeta.description
        : t('features.dubbing.components.steps.uploadSettingsStep.defaultDescription', { title: videoMeta.title })
    }
    if (Object.keys(patch).length > 0) setUploadSettings(patch)
  }, [locale, t, videoMeta?.description, videoMeta?.id, videoMeta?.title, setUploadSettings])

  // 입력 도중엔 원시 문자열을 유지해 콤마/공백을 자유롭게 입력 가능.
  // blur 시점에만 배열로 정규화해 store에 반영한다.
  const [tagsInput, setTagsInput] = useState(() => uploadSettings.tags.join(', '))
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setTagsInput(uploadSettings.tags.join(', '))
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [uploadSettings.tags])

  const commitTags = () => {
    const parsed = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    setUploadSettings({ tags: parsed })
  }
  const [playlistInput, setPlaylistInput] = useState(() => formatPlaylistIds(uploadSettings.playlistIds))
  const thumbnailFileInputRef = useRef<HTMLInputElement>(null)
  const [thumbnailUploading, setThumbnailUploading] = useState(false)
  const [thumbnailProgress, setThumbnailProgress] = useState(0)
  const [thumbnailError, setThumbnailError] = useState<string | null>(null)
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPlaylistInput(formatPlaylistIds(uploadSettings.playlistIds))
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [uploadSettings.playlistIds])

  const commitPlaylists = () => {
    setUploadSettings({ playlistIds: parsePlaylistIds(playlistInput) })
  }

  const isMultiAudio = deliverableMode === 'originalWithMultiAudio'
  const uploadsVideoToYouTube =
    deliverableMode === 'newDubbedVideos' ||
    (isMultiAudio && videoSource?.type === 'upload')
  const hasPublishSchedule = hasScheduledPublish(uploadSettings.publishAt)
  const visibilityValue = effectivePrivacyStatus(uploadSettings.privacyStatus, uploadSettings.publishAt)
  const publishAtTimeZone = normalizePublishTimeZone(uploadSettings.publishAtTimeZone)
  const scheduleInvalid = hasPublishSchedule && !isFuturePublishAt(uploadSettings.publishAt)
  const shouldShowAiDisclosure = deliverableMode === 'newDubbedVideos'
  const canContinue =
    (deliverableMode === 'originalWithMultiAudio'
      ? true
      : uploadSettings.title.trim().length > 0) &&
    !scheduleInvalid
  const handleSyntheticMediaToggle = () => {
    setUploadSettings({
      containsSyntheticMedia: !uploadSettings.containsSyntheticMedia,
      description: stripAiDisclosureFooter(uploadSettings.description),
    })
  }
  const handleAutoUploadToggle = () => {
    const nextAutoUpload = !uploadSettings.autoUpload
    setUploadSettings(nextAutoUpload
      ? { autoUpload: true, uploadCaptions: true }
      : { autoUpload: false, uploadCaptions: false })
  }
  const handlePublishAtChange = (value: string) => {
    const publishAt = fromDateTimeLocalInputValue(value, publishAtTimeZone)
    setUploadSettings({
      publishAt,
      ...(publishAt ? { privacyStatus: 'private' as PrivacyStatus } : {}),
    })
  }
  const handlePublishScheduleToggle = () => {
    if (hasPublishSchedule) {
      setUploadSettings({ publishAt: null })
      return
    }

    setUploadSettings({
      publishAt: fromDateTimeLocalInputValue(minDateTimeLocalInputValue(60, publishAtTimeZone), publishAtTimeZone),
      privacyStatus: 'private',
    })
  }
  const handlePublishAtTimeZoneChange = (timeZone: string) => {
    const nextTimeZone = normalizePublishTimeZone(timeZone)
    const localValue = toDateTimeLocalInputValue(uploadSettings.publishAt, publishAtTimeZone)
    setUploadSettings({
      publishAtTimeZone: nextTimeZone,
      publishAt: localValue ? fromDateTimeLocalInputValue(localValue, nextTimeZone) : uploadSettings.publishAt,
    })
  }
  const captionUploadDisabled =
    deliverableMode === 'newDubbedVideos' && !uploadSettings.autoUpload

  const handleThumbnailFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      setThumbnailError(uploadOptionText.thumbnailInvalidType)
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setThumbnailError(uploadOptionText.thumbnailTooLarge)
      return
    }

    setThumbnailError(null)
    setThumbnailUploading(true)
    setThumbnailProgress(0)
    try {
      const { blobSasUrl } = await getSasToken(file.name)
      await uploadFileToBlob(blobSasUrl, file, setThumbnailProgress, file.type)
      setUploadSettings({ thumbnailUrl: blobSasUrl.split('?')[0] })
      setThumbnailProgress(100)
    } catch (err) {
      console.warn('[sub2tube] Thumbnail upload failed', err)
      setThumbnailError(uploadOptionText.thumbnailUploadFailed)
    } finally {
      setThumbnailUploading(false)
    }
  }

  useEffect(() => {
    if (!uploadsVideoToYouTube && uploadSettings.publishAt) {
      setUploadSettings({ publishAt: null })
    }
  }, [uploadsVideoToYouTube, uploadSettings.publishAt, setUploadSettings])

  useEffect(() => {
    if (hasPublishSchedule && uploadSettings.privacyStatus !== 'private') {
      setUploadSettings({ privacyStatus: 'private' })
    }
  }, [hasPublishSchedule, uploadSettings.privacyStatus, setUploadSettings])

  const hasMetadataSection = deliverableMode === 'newDubbedVideos' || (isMultiAudio && videoSource?.type === 'upload')
  const sectionOrder = [
    ...(hasMetadataSection ? ['metadata'] : []),
    'automation',
    ...(uploadsVideoToYouTube ? ['publish', 'youtube'] : []),
    ...(uploadsVideoToYouTube || isMultiAudio ? ['policy'] : []),
  ]
  const sectionOrderKey = sectionOrder.join('|')
  const [sectionState, setSectionState] = useState<{ key: string; open: Set<string> }>(() => ({
    key: sectionOrderKey,
    open: new Set(sectionOrder.slice(0, 1)),
  }))
  const openSections = sectionState.key === sectionOrderKey
    ? sectionState.open
    : new Set(sectionOrder.slice(0, 1))
  const updateOpenSections = (updater: (current: Set<string>) => Set<string>) => {
    setSectionState((current) => {
      const currentOpen = current.key === sectionOrderKey
        ? current.open
        : new Set(sectionOrder.slice(0, 1))
      return { key: sectionOrderKey, open: updater(currentOpen) }
    })
  }

  const isSectionOpen = (id: string) => openSections.has(id)
  const toggleSettingsSection = (id: string) => {
    updateOpenSections((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }
  const advanceSettingsSection = (id: string) => {
    const currentIndex = sectionOrder.indexOf(id)
    const nextId = sectionOrder[currentIndex + 1]
    updateOpenSections((current) => {
      const next = new Set([...current].filter((sectionId) => sectionOrder.includes(sectionId)))
      next.delete(id)
      if (nextId) next.add(nextId)
      return next
    })
  }
  const canAdvanceSettingsSection = (id: string) => {
    const currentIndex = sectionOrder.indexOf(id)
    return currentIndex >= 0 && currentIndex < sectionOrder.length - 1
  }
  const settingsSectionText = {
    metadataTitle: deliverableMode === 'newDubbedVideos'
      ? t('features.dubbing.components.steps.uploadSettingsStep.titleDescriptionAndTags')
      : t('features.dubbing.components.steps.uploadSettingsStep.originalVideoUploadSettings'),
    metadataDescription: locale === 'ko'
      ? '업로드에 사용할 제목, 설명, 태그 언어를 먼저 정리합니다.'
      : 'Prepare the title, description, tags, and metadata language first.',
    automationTitle: locale === 'ko' ? '업로드 방식' : 'Upload flow',
    automationDescription: locale === 'ko'
      ? '자동 업로드, 자막 업로드, 원본 링크 첨부 여부를 고릅니다.'
      : 'Choose auto-upload, caption upload, and original link attachment.',
    publishTitle: locale === 'ko' ? '공개/예약' : 'Visibility and schedule',
    publishDescription: locale === 'ko'
      ? '공개 범위, 예약 공개 시간, 구독자 알림을 설정합니다.'
      : 'Set visibility, scheduled publish time, and subscriber notifications.',
    youtubeDescription: locale === 'ko'
      ? '카테고리, 썸네일, 플레이리스트를 업로드 요청에 함께 보냅니다.'
      : 'Send category, thumbnail, and playlist details with the upload request.',
    policyTitle: locale === 'ko' ? '자막/정책' : 'Captions and policy',
    policyDescription: locale === 'ko'
      ? '자막 업로드와 YouTube 정책 관련 값을 확인합니다.'
      : 'Review caption upload and YouTube policy fields.',
    continueLabel: locale === 'ko' ? '다음 설정' : 'Next setting',
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {hasMetadataSection && (
        <SettingsSection
          id="metadata"
          title={settingsSectionText.metadataTitle}
          description={settingsSectionText.metadataDescription}
          open={isSectionOpen('metadata')}
          onToggle={toggleSettingsSection}
          onContinue={canAdvanceSettingsSection('metadata') ? () => advanceSettingsSection('metadata') : undefined}
          continueLabel={settingsSectionText.continueLabel}
        >
          {deliverableMode === 'newDubbedVideos' ? (
            <>
              <Select
                label={t('features.dubbing.components.steps.uploadSettingsStep.titleAndDescriptionLanguage')}
                value={uploadSettings.metadataLanguage}
                onChange={(e) => setUploadSettings({ metadataLanguage: e.target.value })}
                options={languageOptions}
              />
              <p className="-mt-2 text-xs text-surface-500 dark:text-surface-300">
                {t('features.dubbing.components.steps.uploadSettingsStep.thisIsTheLanguageYouWriteInTitles')}
              </p>

              <Input
                label={t('features.dubbing.components.steps.uploadSettingsStep.title')}
                value={uploadSettings.title}
                onChange={(e) => setUploadSettings({ title: e.target.value })}
                placeholder={t('features.dubbing.components.steps.uploadSettingsStep.videoTitle')}
              />

              <div className="w-full">
                <label htmlFor="upload-description" className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">
                  {t('features.dubbing.components.steps.uploadSettingsStep.description')}
                </label>
                <textarea
                  id="upload-description"
                  rows={4}
                  value={uploadSettings.description}
                  onChange={(e) => setUploadSettings({ description: e.target.value })}
                  placeholder={t('features.dubbing.components.steps.uploadSettingsStep.videoDescription')}
                  className="w-full resize-none rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 placeholder:text-surface-500 transition-colors focus-ring dark:border-surface-700 dark:bg-surface-800 dark:text-surface-100 dark:placeholder:text-surface-400"
                />
                {uploadSettings.containsSyntheticMedia && shouldShowAiDisclosure && (
                  <AiDisclosurePreview text={aiDisclosureText} />
                )}
              </div>

              <Input
                label={t('features.dubbing.components.steps.uploadSettingsStep.tagsCommaSeparated')}
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                onBlur={commitTags}
                placeholder={t('features.dubbing.components.steps.uploadSettingsStep.dubtubeAIDubbingReview')}
              />
              <p className="-mt-2 text-xs text-surface-500 dark:text-surface-300">
                {t('features.dubbing.components.steps.uploadSettingsStep.tagsAreUsedAsWrittenAndAreNot')}
              </p>
            </>
          ) : (
            <>
              <Select
                label={t('features.dubbing.components.steps.uploadSettingsStep.titleAndDescriptionLanguage2')}
                value={uploadSettings.metadataLanguage}
                onChange={(e) => setUploadSettings({ metadataLanguage: e.target.value })}
                options={languageOptions}
              />
              <p className="-mt-2 text-xs text-surface-500 dark:text-surface-300">
                {t('features.dubbing.components.steps.uploadSettingsStep.thisIsTheLanguageYouWriteInTitles2')}
              </p>

              <Input
                label={t('features.dubbing.components.steps.uploadSettingsStep.title2')}
                value={uploadSettings.title}
                onChange={(e) => setUploadSettings({ title: e.target.value })}
                placeholder={t('features.dubbing.components.steps.uploadSettingsStep.videoTitle2')}
              />

              <div className="w-full">
                <label htmlFor="upload-description" className="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">
                  {t('features.dubbing.components.steps.uploadSettingsStep.description2')}
                </label>
                <textarea
                  id="upload-description"
                  rows={3}
                  value={uploadSettings.description}
                  onChange={(e) => setUploadSettings({ description: e.target.value })}
                  placeholder={t('features.dubbing.components.steps.uploadSettingsStep.videoDescription2')}
                  className="w-full resize-none rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 placeholder:text-surface-500 transition-colors focus-ring dark:border-surface-700 dark:bg-surface-800 dark:text-surface-100 dark:placeholder:text-surface-400"
                />
                {uploadSettings.containsSyntheticMedia && shouldShowAiDisclosure && (
                  <AiDisclosurePreview text={aiDisclosureText} />
                )}
              </div>

              <Input
                label={t('features.dubbing.components.steps.uploadSettingsStep.tagsCommaSeparated2')}
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                onBlur={commitTags}
                placeholder={t('features.dubbing.components.steps.uploadSettingsStep.dubtubeAIDubbingCaptions')}
              />
              <p className="-mt-2 text-xs text-surface-500 dark:text-surface-300">
                {t('features.dubbing.components.steps.uploadSettingsStep.tagsAreUsedAsWrittenAndAreNot2')}
              </p>
            </>
          )}
        </SettingsSection>
      )}

      <SettingsSection
        id="automation"
        title={settingsSectionText.automationTitle}
        description={settingsSectionText.automationDescription}
        open={isSectionOpen('automation')}
        onToggle={toggleSettingsSection}
        onContinue={canAdvanceSettingsSection('automation') ? () => advanceSettingsSection('automation') : undefined}
        continueLabel={settingsSectionText.continueLabel}
      >
        <ToggleRow
          icon={<Upload className="h-4 w-4 text-emerald-500" />}
          label={t('features.dubbing.components.steps.uploadSettingsStep.autoUploadWhenFinished')}
          description={isMultiAudio
            ? t('features.dubbing.components.steps.uploadSettingsStep.automaticallyUploadTranslatedCaptionsWhenProcessingFinishes')
            : t('features.dubbing.components.steps.uploadSettingsStep.automaticallyUploadEachDubbedVideoWhenProcessingFinishes')}
          active={uploadSettings.autoUpload}
          activeLabel={t('features.dubbing.components.steps.uploadSettingsStep.on')}
          inactiveLabel={t('features.dubbing.components.steps.uploadSettingsStep.off')}
          onToggle={handleAutoUploadToggle}
        />

        {(deliverableMode === 'newDubbedVideos' || isMultiAudio) && (
          <ToggleRow
            icon={<Captions className="h-4 w-4 text-surface-400" />}
            label={isMultiAudio
              ? t('features.dubbing.components.steps.uploadSettingsStep.uploadCaptionsSRT')
              : t('features.dubbing.components.steps.uploadSettingsStep.uploadCaptionsSRTWithDubbedVideos')}
            description={isMultiAudio
              ? t('features.dubbing.components.steps.uploadSettingsStep.uploadTranslatedCaptionsForEachCompletedLanguageTo')
              : t('features.dubbing.components.steps.uploadSettingsStep.uploadMatchingCaptionsWithEachSelectedLanguageVideo')}
            active={captionUploadDisabled ? false : uploadSettings.uploadCaptions}
            activeLabel={t('features.dubbing.components.steps.uploadSettingsStep.on2')}
            inactiveLabel={t('features.dubbing.components.steps.uploadSettingsStep.off2')}
            onToggle={() => setUploadSettings({ uploadCaptions: !uploadSettings.uploadCaptions })}
            disabled={captionUploadDisabled}
            disabledBadgeLabel={t('features.dubbing.components.steps.uploadSettingsStep.autoUploadOff')}
          />
        )}

        {originalYouTubeUrl && deliverableMode === 'newDubbedVideos' && (
          <ToggleRow
            icon={<Link2 className="h-4 w-4 text-surface-400" />}
            label={t('features.dubbing.components.steps.uploadSettingsStep.addOriginalYouTubeLinkToDescription')}
            description={originalYouTubeUrl}
            active={uploadSettings.attachOriginalLink}
            activeLabel={t('features.dubbing.components.steps.uploadSettingsStep.on3')}
            inactiveLabel={t('features.dubbing.components.steps.uploadSettingsStep.off3')}
            onToggle={() => setUploadSettings({ attachOriginalLink: !uploadSettings.attachOriginalLink })}
          />
        )}
      </SettingsSection>

      {uploadsVideoToYouTube && (
        <SettingsSection
          id="publish"
          title={settingsSectionText.publishTitle}
          description={settingsSectionText.publishDescription}
          open={isSectionOpen('publish')}
          onToggle={toggleSettingsSection}
          onContinue={canAdvanceSettingsSection('publish') ? () => advanceSettingsSection('publish') : undefined}
          continueLabel={settingsSectionText.continueLabel}
        >
          <SchedulePublishRow
            active={hasPublishSchedule}
            value={toDateTimeLocalInputValue(uploadSettings.publishAt, publishAtTimeZone)}
            min={minDateTimeLocalInputValue(1, publishAtTimeZone)}
            timeZone={publishAtTimeZone}
            invalid={scheduleInvalid}
            activeLabel={t('features.dubbing.components.steps.uploadSettingsStep.on5')}
            inactiveLabel={t('features.dubbing.components.steps.uploadSettingsStep.off4')}
            onToggle={handlePublishScheduleToggle}
            onChange={handlePublishAtChange}
            onTimeZoneChange={handlePublishAtTimeZoneChange}
          />

          <Select
            label={deliverableMode === 'newDubbedVideos'
              ? t('features.dubbing.components.steps.uploadSettingsStep.visibility')
              : t('features.dubbing.components.steps.uploadSettingsStep.visibility2')}
            value={visibilityValue}
            onChange={(e) => setUploadSettings({ privacyStatus: e.target.value as PrivacyStatus })}
            disabled={hasPublishSchedule}
            options={privacyOptions}
          />
          {hasPublishSchedule && (
            <p className="-mt-2 text-xs text-surface-500 dark:text-surface-300">
              {t('features.dubbing.components.steps.uploadSettingsStep.scheduledUploadsArePrivateUntilPublish')}
            </p>
          )}

          <ToggleRow
            icon={<Bell className="h-4 w-4 text-surface-400" />}
            label={uploadOptionText.notifySubscribers}
            description={uploadOptionText.notifySubscribersDescription}
            active={uploadSettings.notifySubscribers}
            activeLabel={t('features.dubbing.components.steps.uploadSettingsStep.on5')}
            inactiveLabel={t('features.dubbing.components.steps.uploadSettingsStep.off4')}
            onToggle={() => setUploadSettings({ notifySubscribers: !uploadSettings.notifySubscribers })}
          />
        </SettingsSection>
      )}

      {uploadsVideoToYouTube && (
        <SettingsSection
          id="youtube"
          title={uploadOptionText.postUploadOptions}
          description={settingsSectionText.youtubeDescription}
          open={isSectionOpen('youtube')}
          onToggle={toggleSettingsSection}
          onContinue={canAdvanceSettingsSection('youtube') ? () => advanceSettingsSection('youtube') : undefined}
          continueLabel={settingsSectionText.continueLabel}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label={uploadOptionText.category}
              value={uploadSettings.categoryId}
              onChange={(e) => setUploadSettings({ categoryId: e.target.value })}
              options={categoryOptions}
            />
            <div className="space-y-2">
              <Input
                label={uploadOptionText.thumbnailUrl}
                value={uploadSettings.thumbnailUrl}
                onChange={(e) => {
                  setThumbnailError(null)
                  setUploadSettings({ thumbnailUrl: e.target.value })
                }}
                placeholder={uploadOptionText.thumbnailPlaceholder}
                icon={<Image className="h-4 w-4" />}
              />
              <input
                ref={thumbnailFileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleThumbnailFileChange}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => thumbnailFileInputRef.current?.click()}
                  loading={thumbnailUploading}
                  disabled={thumbnailUploading}
                >
                  <Image className="h-4 w-4" />
                  {uploadOptionText.thumbnailUpload}
                </Button>
                {uploadSettings.thumbnailUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setThumbnailError(null)
                      setUploadSettings({ thumbnailUrl: '' })
                    }}
                    disabled={thumbnailUploading}
                  >
                    {uploadOptionText.thumbnailRemove}
                  </Button>
                )}
              </div>
              <p className="text-xs leading-5 text-surface-500 dark:text-surface-300">
                {thumbnailUploading
                  ? `${uploadOptionText.thumbnailUploading} ${thumbnailProgress}%`
                  : uploadOptionText.thumbnailHelp}
              </p>
              {thumbnailError && (
                <p className="text-xs leading-5 text-red-500">{thumbnailError}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Input
                label={uploadOptionText.playlists}
                value={playlistInput}
                onChange={(e) => setPlaylistInput(e.target.value)}
                onBlur={commitPlaylists}
                placeholder={uploadOptionText.playlistsPlaceholder}
                icon={<ListPlus className="h-4 w-4" />}
              />
            </div>
          </div>
        </SettingsSection>
      )}

      {(uploadsVideoToYouTube || isMultiAudio) && (
        <SettingsSection
          id="policy"
          title={settingsSectionText.policyTitle}
          description={settingsSectionText.policyDescription}
          open={isSectionOpen('policy')}
          onToggle={toggleSettingsSection}
          onContinue={canAdvanceSettingsSection('policy') ? () => advanceSettingsSection('policy') : undefined}
          continueLabel={settingsSectionText.continueLabel}
        >
          {uploadsVideoToYouTube && (
            <>
              <ToggleRow
                icon={<ShieldCheck className="h-4 w-4 text-surface-400" />}
                label={t('features.dubbing.components.steps.uploadSettingsStep.madeForKids')}
                description={t('features.dubbing.components.steps.uploadSettingsStep.setThisAccordingToYouTubeMadeForKids')}
                active={uploadSettings.selfDeclaredMadeForKids}
                activeLabel={t('features.dubbing.components.steps.uploadSettingsStep.yes')}
                inactiveLabel={t('features.dubbing.components.steps.uploadSettingsStep.no')}
                onToggle={() => setUploadSettings({ selfDeclaredMadeForKids: !uploadSettings.selfDeclaredMadeForKids })}
              />

              {shouldShowAiDisclosure && (
                <ToggleRow
                  icon={<Sparkles className="h-4 w-4 text-amber-500" />}
                  label={t('features.dubbing.components.steps.uploadSettingsStep.discloseAIVoiceUse')}
                  description={t('features.dubbing.components.steps.uploadSettingsStep.addsANoteAtTheEndOfThe')}
                  active={uploadSettings.containsSyntheticMedia}
                  activeLabel={t('features.dubbing.components.steps.uploadSettingsStep.on4')}
                  inactiveLabel={t('features.dubbing.components.steps.uploadSettingsStep.off4')}
                  onToggle={handleSyntheticMediaToggle}
                />
              )}
            </>
          )}

          {isMultiAudio && (
            <ToggleRow
              icon={<Languages className="h-4 w-4 text-surface-400" />}
              label={t('features.dubbing.components.steps.uploadSettingsStep.addMultilingualAudioTracks')}
              description={t('features.dubbing.components.steps.uploadSettingsStep.youTubeMultilingualAudioTracksAreComingSoon')}
              active={false}
              activeLabel={t('features.dubbing.components.steps.uploadSettingsStep.on5')}
              inactiveLabel={t('features.dubbing.components.steps.uploadSettingsStep.soon')}
              onToggle={() => {}}
              disabled
            />
          )}
        </SettingsSection>
      )}

      <div className="flex justify-between">
        <Button variant="secondary" onClick={prevStep}>
          <ArrowLeft className="h-4 w-4" />
          {t('features.dubbing.components.steps.uploadSettingsStep.back')}
        </Button>
        <Button onClick={nextStep} disabled={!canContinue}>
          {t('features.dubbing.components.steps.uploadSettingsStep.nextReviewSettings')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function AiDisclosurePreview({ text }: { text: string }) {
  const t = useLocaleText()

  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/70 dark:bg-amber-950/20">
      <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
        {t('features.dubbing.components.steps.uploadSettingsStep.automaticallyAddedToTheEndOfTheDescription')}
      </p>
      <p className="mt-1 text-xs leading-5 text-surface-700 dark:text-surface-200">
        {text}
      </p>
    </div>
  )
}

interface SettingsSectionProps {
  id: string
  title: string
  description?: string
  open: boolean
  onToggle: (id: string) => void
  onContinue?: () => void
  continueLabel: string
  children: ReactNode
}

function SettingsSection({
  id,
  title,
  description,
  open,
  onToggle,
  onContinue,
  continueLabel,
  children,
}: SettingsSectionProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-50 focus-ring dark:hover:bg-surface-850"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-surface-900 dark:text-white">{title}</span>
          {description && (
            <span className="mt-1 block text-xs leading-5 text-surface-500 dark:text-surface-300">
              {description}
            </span>
          )}
        </span>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-surface-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="border-t border-surface-100 p-4 dark:border-surface-800">
          <div className="space-y-4">{children}</div>
          {onContinue && (
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="secondary" onClick={onContinue}>
                {continueLabel}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

interface SchedulePublishRowProps {
  active: boolean
  value: string
  min: string
  timeZone: string
  invalid: boolean
  activeLabel: string
  inactiveLabel: string
  onToggle: () => void
  onChange: (value: string) => void
  onTimeZoneChange: (timeZone: string) => void
}

function SchedulePublishRow({
  active,
  value,
  min,
  timeZone,
  invalid,
  activeLabel,
  inactiveLabel,
  onToggle,
  onChange,
  onTimeZoneChange,
}: SchedulePublishRowProps) {
  const t = useLocaleText()

  return (
    <div className="rounded-lg bg-surface-50 p-3 dark:bg-surface-800/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <CalendarClock className="mt-0.5 h-4 w-4 flex-shrink-0 text-surface-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-surface-700 dark:text-surface-300">
              {t('features.dubbing.components.steps.uploadSettingsStep.schedulePublish')}
            </p>
            <p className="mt-1 text-xs leading-5 text-surface-500 dark:text-surface-300">
              {t('features.dubbing.components.steps.uploadSettingsStep.schedulePublishDescription')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={active}
          aria-label={`${t('features.dubbing.components.steps.uploadSettingsStep.schedulePublish')}: ${active ? activeLabel : inactiveLabel}`}
          className="inline-flex shrink-0 self-start rounded-full transition-opacity hover:opacity-85 focus-ring sm:self-auto"
        >
          <span
            className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
              active ? 'bg-brand-600' : 'bg-surface-300 dark:bg-surface-600'
            }`}
            aria-hidden="true"
          >
            <span
              className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                active ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </span>
        </button>
      </div>

      {active && (
        <div className="mt-3 space-y-2 pl-0 sm:pl-6">
          <Input
            type="datetime-local"
            value={value}
            min={min}
            onChange={(e) => onChange(e.target.value)}
            aria-label={t('features.dubbing.components.steps.uploadSettingsStep.schedulePublish')}
          />
          <Select
            label={t('features.dubbing.components.steps.uploadSettingsStep.publishTimeZone')}
            value={timeZone}
            onChange={(e) => onTimeZoneChange(e.target.value)}
            options={getSupportedPublishTimeZones().map((zone) => ({
              value: zone,
              label: zone.replaceAll('_', ' '),
            }))}
          />
          {invalid && (
            <p className="text-xs text-red-500">
              {t('features.dubbing.components.steps.uploadSettingsStep.publishTimeMustBeFuture')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

interface ToggleRowProps {
  icon: ReactNode
  label: string
  description?: string
  active: boolean
  activeLabel: string
  inactiveLabel: string
  onToggle: () => void
  disabled?: boolean
  disabledBadgeLabel?: string
}

function ToggleRow({ icon, label, description, active, activeLabel, inactiveLabel, onToggle, disabled, disabledBadgeLabel }: ToggleRowProps) {
  const t = useLocaleText()

  return (
    <div className={`flex flex-col gap-3 rounded-lg bg-surface-50 p-3 dark:bg-surface-800/50 sm:flex-row sm:items-start sm:justify-between ${disabled ? 'opacity-75' : ''}`}>
      <div className="flex min-w-0 items-start gap-2">
        <div className="mt-0.5 flex-shrink-0">{icon}</div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm text-surface-700 dark:text-surface-300">{label}</p>
            {disabled && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                {disabledBadgeLabel ?? t('features.dubbing.components.steps.uploadSettingsStep.comingSoon')}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1 text-xs leading-5 text-surface-500 dark:text-surface-300">{description}</p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        aria-pressed={active}
        aria-label={`${label}: ${active ? activeLabel : inactiveLabel}`}
        className={`inline-flex shrink-0 self-start rounded-full transition-opacity focus-ring sm:self-auto ${
          disabled
            ? 'cursor-not-allowed opacity-60'
            : 'cursor-pointer hover:opacity-85'
        }`}
      >
        <span
          className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
            active && !disabled
              ? 'bg-brand-600'
              : 'bg-surface-300 dark:bg-surface-600'
          }`}
          aria-hidden="true"
        >
          <span
            className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
              active ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </span>
      </button>
    </div>
  )
}
