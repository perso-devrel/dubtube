'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import { AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react'
import { Button, Card, Badge } from '@/components/ui'
import { cn } from '@/utils/cn'
import { useAppLocale, useLocaleText } from '@/hooks/useLocaleText'
import { useLocaleRouter } from '@/hooks/useLocalePath'
import { getLanguageByCode } from '@/utils/languages'
import { useAuthStore } from '@/stores/authStore'
import { useChannelStats } from '@/hooks/useYouTubeData'
import { getYouTubeCategoryLabel } from '@/lib/youtube/upload-options'
import { effectivePrivacyStatus, hasScheduledPublish, normalizePublishTimeZone } from '@/lib/youtube/publish-schedule'
import { useDubbingStore } from '../../store/dubbingStore'
import type { PrivacyStatus } from '../../types/dubbing.types'

const PRIVACY_LABELS: Record<PrivacyStatus, string> = {
  private: 'privacyStatus.private',
  unlisted: 'privacyStatus.unlisted',
  public: 'privacyStatus.public',
}

export function TranslationEditStep() {
  const {
    selectedLanguages,
    videoSource,
    deliverableMode,
    uploadSettings,
    setUploadSettings,
    prevStep,
    nextStep,
  } = useDubbingStore()
  const user = useAuthStore((s) => s.user)
  const authLoading = useAuthStore((s) => s.isLoading)
  const { data: channel, isLoading: channelLoading } = useChannelStats()
  const locale = useAppLocale()
  const t = useLocaleText()
  const router = useLocaleRouter()
  const summaryText = {
    scheduledPublish: locale === 'ko' ? '예약 공개' : 'Scheduled publish',
    category: locale === 'ko' ? '카테고리' : 'Category',
    thumbnail: locale === 'ko' ? '썸네일' : 'Thumbnail',
    playlists: locale === 'ko' ? '플레이리스트' : 'Playlists',
    notifySubscribers: locale === 'ko' ? '구독자 알림' : 'Subscriber notifications',
  }

  const needsAutoUploadReview = uploadSettings.autoUpload && deliverableMode !== 'downloadOnly'
  const needsYouTubeConnection = deliverableMode !== 'downloadOnly'
  const checkingYouTubeConnection = needsYouTubeConnection && (authLoading || channelLoading)
  const youtubeConnectionMissing = !checkingYouTubeConnection && needsYouTubeConnection && !channel
  const canStart =
    !checkingYouTubeConnection &&
    !youtubeConnectionMissing &&
    (!needsAutoUploadReview || uploadSettings.uploadReviewConfirmed)
  const effectivePrivacy = effectivePrivacyStatus(uploadSettings.privacyStatus, uploadSettings.publishAt)
  const privacyLabel = t(PRIVACY_LABELS[effectivePrivacy] ?? effectivePrivacy)
  const targetChannelLabel = channel
    ? t('features.dubbing.components.steps.translationEditStep.channelWithSubscriberCount', {
      title: channel.title,
      count: channel.subscriberCount.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US'),
    })
    : user?.displayName ?? t('features.dubbing.components.steps.translationEditStep.noConnectedYouTubeChannel')
  const uploadsVideoToYouTube =
    deliverableMode === 'newDubbedVideos' ||
    (deliverableMode === 'originalWithMultiAudio' && videoSource?.type === 'upload')
  const showsAiDisclosureSetting = deliverableMode === 'newDubbedVideos'
  const showsCaptionSetting = deliverableMode === 'newDubbedVideos' || deliverableMode === 'originalWithMultiAudio'
  const publishAt = uploadSettings.publishAt
  const hasPublishSchedule = hasScheduledPublish(publishAt)
  const publishAtTimeZone = normalizePublishTimeZone(uploadSettings.publishAtTimeZone)
  const deliverableModeLabel = deliverableMode === 'newDubbedVideos'
    ? t('features.dubbing.components.steps.translationEditStep.uploadNewDubbedVideos')
    : deliverableMode === 'originalWithMultiAudio'
      ? t('features.dubbing.components.steps.translationEditStep.addCaptionsToOriginalVideo')
      : t('features.dubbing.components.steps.translationEditStep.downloadFilesOnly')
  const metadataLanguageLabel =
    (() => {
      const language = getLanguageByCode(uploadSettings.metadataLanguage)
      if (!language) return uploadSettings.metadataLanguage
      return locale === 'ko' ? language.nativeName : language.name
    })()
  const tagsLabel = uploadSettings.tags.length > 0 ? uploadSettings.tags.join(', ') : t('features.dubbing.components.steps.translationEditStep.none')
  const categoryLabel = `${getYouTubeCategoryLabel(uploadSettings.categoryId, locale)} (${uploadSettings.categoryId})`
  const scheduledPublishLabel = hasPublishSchedule
    ? `${new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: publishAtTimeZone,
    }).format(new Date(publishAt))} (${publishAtTimeZone})`
    : null
  const playlistLabel = uploadSettings.playlistIds.length > 0
    ? uploadSettings.playlistIds.join(', ')
    : t('features.dubbing.components.steps.translationEditStep.none')
  const autoUploadConfirmationText = uploadsVideoToYouTube
    ? t('features.dubbing.components.steps.translationEditStep.iReviewedTheSettingsAndWantToUpload')
    : t('features.dubbing.components.steps.translationEditStep.iReviewedTheSettingsAndWantToUpload2')

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Summary card */}
      <Card>
        {youtubeConnectionMissing && (
          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/70 dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-medium text-amber-900 dark:text-amber-300">
                  {t('features.dubbing.components.steps.outputModeStep.youtubeConnectionRequired')}
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-700 dark:text-amber-400">
                  {t('features.dubbing.components.steps.outputModeStep.connectYouTubeInSettingsToUpload')}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push('/settings?section=youtube')}>
              {t('features.dubbing.components.steps.outputModeStep.connectInSettings')}
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {uploadsVideoToYouTube && (
            <SummaryRow label={t('features.dubbing.components.steps.translationEditStep.channel')} value={targetChannelLabel} />
          )}

          <SummaryRow
            label={t('features.dubbing.components.steps.translationEditStep.targetLanguagesValue', { selectedLanguagesLength: selectedLanguages.length })}
            value={(
              <div className="flex flex-wrap justify-end gap-2">
                {selectedLanguages.map((code) => {
                  const lang = getLanguageByCode(code)
                  if (!lang) return null
                  return (
                    <Badge key={code} variant="brand">
                      {lang.flag} {locale === 'ko' ? lang.nativeName : lang.name}
                    </Badge>
                  )
                })}
              </div>
            )}
          />

          {/*
          Lip sync — 원본+자막 모드는 비디오 픽셀을 건드리지 않으므로 미노출.
          립싱크 UI는 임시 숨김 상태이며, 기능 복구 시 아래 블록과 Toggle import,
          lipSyncEnabled/setLipSync store 값을 함께 되살리면 된다.
          {deliverableMode !== 'originalWithMultiAudio' && (
            <div className="flex items-center justify-between rounded-lg bg-surface-50 p-3 dark:bg-surface-800">
              <div>
                <span className="text-sm text-surface-600 dark:text-surface-400">립싱크</span>
                <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-300">더빙 오디오에 맞춰 입 모양을 조절합니다</p>
              </div>
              <Toggle checked={lipSyncEnabled} onChange={setLipSync} />
            </div>
          )}
          */}

          {uploadsVideoToYouTube && (
            <>
              <SummaryRow
                label={summaryText.scheduledPublish}
                value={scheduledPublishLabel ?? <StatusValue active={false} />}
              />
              <SummaryRow label={t('features.dubbing.components.steps.translationEditStep.visibility')} value={privacyLabel} />
            </>
          )}

          <SummaryRow label={t('features.dubbing.components.steps.translationEditStep.output')} value={deliverableModeLabel} />

          {deliverableMode !== 'downloadOnly' && (
            <SummaryRow
              label={t('features.dubbing.components.steps.translationEditStep.autoUpload')}
              value={<StatusValue active={uploadSettings.autoUpload} />}
            />
          )}

          {showsCaptionSetting && (
            <SummaryRow
              label={t('features.dubbing.components.steps.translationEditStep.captions')}
              value={<StatusValue active={uploadSettings.autoUpload && uploadSettings.uploadCaptions} />}
            />
          )}

          {uploadsVideoToYouTube && (
            <>
              <SummaryRow
                label={t('features.dubbing.components.steps.translationEditStep.writingLanguage')}
                value={t('features.dubbing.components.steps.translationEditStep.metadataBasedOn', { language: metadataLanguageLabel })}
              />
              <SummaryRow
                label={t('features.dubbing.components.steps.translationEditStep.tags')}
                value={tagsLabel}
              />
              <SummaryRow
                label={summaryText.category}
                value={categoryLabel}
              />
              <SummaryRow
                label={summaryText.thumbnail}
                value={
                  uploadSettings.thumbnailUrl
                    ? (
                      <span className="relative block h-10 w-16 shrink-0 overflow-hidden rounded-md border border-surface-200 bg-surface-100 dark:border-surface-700 dark:bg-surface-900">
                        <Image
                          src={uploadSettings.thumbnailUrl}
                          alt=""
                          fill
                          sizes="64px"
                          className="object-cover"
                          unoptimized
                        />
                      </span>
                    )
                    : <StatusValue active={false} />
                }
              />
              <SummaryRow
                label={summaryText.playlists}
                value={playlistLabel}
              />
              <SummaryRow
                label={summaryText.notifySubscribers}
                value={<StatusValue active={uploadSettings.notifySubscribers} />}
              />
              <SummaryRow
                label={t('features.dubbing.components.steps.translationEditStep.madeForKids')}
                value={uploadSettings.selfDeclaredMadeForKids ? t('features.dubbing.components.steps.translationEditStep.yes') : t('features.dubbing.components.steps.translationEditStep.no')}
              />
              {showsAiDisclosureSetting && (
                <SummaryRow
                  label={t('features.dubbing.components.steps.translationEditStep.aIVoiceDisclosure')}
                  value={<StatusValue active={uploadSettings.containsSyntheticMedia} />}
                />
              )}
            </>
          )}
        </div>

        {needsAutoUploadReview && (
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm text-surface-700 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-surface-200">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
              checked={uploadSettings.uploadReviewConfirmed}
              onChange={(e) => setUploadSettings({ uploadReviewConfirmed: e.target.checked })}
            />
            <span>
              {autoUploadConfirmationText}
            </span>
          </label>
        )}
      </Card>

      <div className="flex justify-between">
        <Button variant="secondary" onClick={prevStep}>
          <ArrowLeft className="h-4 w-4" />
          {t('features.dubbing.components.steps.translationEditStep.back')}
        </Button>
        <Button onClick={nextStep} disabled={!canStart}>
          {t('features.dubbing.components.steps.translationEditStep.startDubbing')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  description,
}: {
  label: string
  value: ReactNode
  description?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg bg-surface-50 p-3 dark:bg-surface-800">
      <div className="min-w-0">
        <span className="text-sm text-surface-600 dark:text-surface-300">{label}</span>
        {description && (
          <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-300">{description}</p>
        )}
      </div>
      <div className="max-w-[60%] break-words text-right text-sm font-medium text-surface-900 dark:text-white">
        {value}
      </div>
    </div>
  )
}

function StatusValue({ active }: { active: boolean }) {
  const t = useLocaleText()

  return (
    <span className={cn(
      active ? 'text-emerald-600 dark:text-emerald-400' : 'text-surface-500 dark:text-surface-300',
    )}>
      {active ? t('features.dubbing.components.steps.translationEditStep.on') : t('features.dubbing.components.steps.translationEditStep.off')}
    </span>
  )
}
