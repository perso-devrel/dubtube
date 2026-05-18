'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarClock, Captions, Languages, Link2, ShieldCheck, Sparkles, Upload } from 'lucide-react'
import { Button, Card, CardTitle, Input, Select } from '@/components/ui'
import { useAppLocale, useLocaleText } from '@/hooks/useLocaleText'
import { extractVideoId } from '@/utils/validators'
import { SUPPORTED_LANGUAGES } from '@/utils/languages'
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

  useEffect(() => {
    if (!uploadsVideoToYouTube && uploadSettings.publishAt) {
      setUploadSettings({ publishAt: null })
    }
  }, [uploadsVideoToYouTube, uploadSettings.publishAt, setUploadSettings])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-surface-900 dark:text-white">{t('features.dubbing.components.steps.uploadSettingsStep.uploadSettings')}</h2>
        <p className="mt-1 text-surface-600 dark:text-surface-400">
          {isMultiAudio
            ? t('features.dubbing.components.steps.uploadSettingsStep.reviewTheSettingsBeforeAddingCaptionsToThe')
            : t('features.dubbing.components.steps.uploadSettingsStep.chooseHowTheFinishedDubbingShouldBeUploaded')}
        </p>
      </div>

      {/* Title/Desc/Tags — for new dubbed video uploads */}
      {deliverableMode === 'newDubbedVideos' && (
        <Card>
          <CardTitle>{t('features.dubbing.components.steps.uploadSettingsStep.titleDescriptionAndTags')}</CardTitle>
          <div className="space-y-4">
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

            <Select
              label={t('features.dubbing.components.steps.uploadSettingsStep.visibility')}
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
          </div>
        </Card>
      )}

      {/* Multi-audio: show privacy for original upload if source is file upload */}
      {isMultiAudio && videoSource?.type === 'upload' && (
        <Card>
          <CardTitle>{t('features.dubbing.components.steps.uploadSettingsStep.originalVideoUploadSettings')}</CardTitle>
          <div className="space-y-4">
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

            <Select
              label={t('features.dubbing.components.steps.uploadSettingsStep.visibility2')}
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
          </div>
        </Card>
      )}

      {/* Upload options — for both newDubbedVideos and originalWithMultiAudio */}
      <Card>
        <CardTitle>{t('features.dubbing.components.steps.uploadSettingsStep.uploadOptions')}</CardTitle>
        <div className="mt-4 space-y-2">
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

          {uploadsVideoToYouTube && (
            <SchedulePublishRow
              value={toDateTimeLocalInputValue(uploadSettings.publishAt, publishAtTimeZone)}
              min={minDateTimeLocalInputValue(1, publishAtTimeZone)}
              timeZone={publishAtTimeZone}
              invalid={scheduleInvalid}
              onChange={handlePublishAtChange}
              onTimeZoneChange={handlePublishAtTimeZoneChange}
            />
          )}

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

          {/* 다국어 오디오 트랙: 자막 모드에서만 노출. 실서비스 검증 전이라 비활성. */}
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
        </div>
      </Card>

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

interface SchedulePublishRowProps {
  value: string
  min: string
  timeZone: string
  invalid: boolean
  onChange: (value: string) => void
  onTimeZoneChange: (timeZone: string) => void
}

function SchedulePublishRow({ value, min, timeZone, invalid, onChange, onTimeZoneChange }: SchedulePublishRowProps) {
  const t = useLocaleText()

  return (
    <div className="rounded-lg bg-surface-50 p-3 dark:bg-surface-800/50">
      <div className="flex min-w-0 items-start gap-2">
        <CalendarClock className="mt-0.5 h-4 w-4 flex-shrink-0 text-surface-400" />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm text-surface-700 dark:text-surface-300">
              {t('features.dubbing.components.steps.uploadSettingsStep.schedulePublish')}
            </p>
            <p className="mt-1 text-xs leading-5 text-surface-500 dark:text-surface-300">
              {t('features.dubbing.components.steps.uploadSettingsStep.schedulePublishDescription')}
            </p>
          </div>
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
      </div>
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
        className={`shrink-0 self-start rounded-full px-3 py-1 text-xs font-medium transition-all sm:self-auto ${
          disabled
            ? 'bg-surface-200 text-surface-500 dark:bg-surface-700 dark:text-surface-300 cursor-not-allowed'
            : `cursor-pointer ${active
              ? 'bg-brand-600 text-white'
              : 'bg-surface-200 text-surface-600 dark:bg-surface-700 dark:text-surface-400'}`
        }`}
      >
        {active ? activeLabel : inactiveLabel}
      </button>
    </div>
  )
}
