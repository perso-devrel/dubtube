'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Link2, Upload, Film, ArrowRight, Play, FileVideo, Zap, Loader2, Search, Lock, Info } from 'lucide-react'

function YouTubeLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="28" height="20" rx="4" fill="#FF0000" />
      <path d="M18.5 10L11.5 14V6L18.5 10Z" fill="white" />
    </svg>
  )
}
import { Card, Button, Input, Badge, Tabs, TabsList, TabsTrigger, TabsContent, Progress } from '@/components/ui'
import { useAppLocale, useLocaleText } from '@/hooks/useLocaleText'
import { useLocaleRouter } from '@/hooks/useLocalePath'
import { useDubbingStore } from '../../store/dubbingStore'
import { usePersoFlow } from '../../hooks/usePersoFlow'
import { isYouTubeConnectionError, useChannelStats, useMyVideos } from '@/hooks/useYouTubeData'
import { useAuthStore } from '@/stores/authStore'
import { isValidVideoUrl, isValidYouTubeUrl } from '@/utils/validators'
import { formatDuration } from '@/utils/formatters'
import { getPersoFileUrl } from '@/lib/api-client'
import { ytListCaptions } from '@/lib/api-client/youtube'
import { fromBcp47 } from '@/utils/languages'
import type { MyVideoItem } from '@/lib/youtube/types'

export function VideoInputStep() {
  const {
    videoMeta,
    setVideoSource,
    setVideoMeta,
    setUploadSettings,
    setIsShort,
    setExistingCaptionLanguages,
    nextStep,
  } = useDubbingStore()
  const { uploadLocalVideo, importVideoByUrl } = usePersoFlow()
  const locale = useAppLocale()
  const t = useLocaleText()
  const localeRouter = useLocaleRouter()

  const searchParams = useSearchParams()
  const [url, setUrl] = useState(searchParams.get('url') ?? '')
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const requestedSource = searchParams.get('source')
  const initialTab = searchParams.get('url')
    ? 'url'
    : requestedSource === 'channel' || requestedSource === 'url' || requestedSource === 'upload'
      ? requestedSource
      : 'upload'
  const [activeTab, setActiveTab] = useState(initialTab)

  const channelTabActive = activeTab === 'channel'
  const authLoading = useAuthStore((s) => s.isLoading)
  const { data: channel, isLoading: channelQueryLoading, error: channelError } = useChannelStats(channelTabActive)
  const channelLoading = authLoading || channelQueryLoading
  const isConnected = !!channel
  const [myVideosLoaded, setMyVideosLoaded] = useState(false)
  const [requestingMyVideos, setRequestingMyVideos] = useState(false)
  const [myVideosPermissionError, setMyVideosPermissionError] = useState<string | null>(null)
  const {
    data: myVideos = [],
    isLoading: loadingMyVideos,
    isFetching: fetchingMyVideos,
    error: myVideosError,
    refetch: refetchMyVideos,
  } = useMyVideos(50, false)
  const myVideosLoading = loadingMyVideos || fetchingMyVideos || requestingMyVideos
  const [videoSearch, setVideoSearch] = useState('')

  const publicVideos = useMemo(
    () => myVideos.filter((v) => v.privacyStatus === 'public'),
    [myVideos],
  )
  const filteredVideos = useMemo(() => {
    const q = videoSearch.trim().toLowerCase()
    if (!q) return publicVideos
    return publicVideos.filter((v) => v.title.toLowerCase().includes(q))
  }, [publicVideos, videoSearch])
  const hiddenCount = myVideos.length - publicVideos.length

  const goToYouTubeSettings = () => {
    localeRouter.push('/settings?section=youtube')
  }

  const handleLoadMyVideos = async () => {
    if (!isConnected) {
      goToYouTubeSettings()
      return
    }
    setRequestingMyVideos(true)
    setMyVideosPermissionError(null)
    try {
      const result = await refetchMyVideos()
      if (result.error) throw result.error
      setMyVideosLoaded(true)
    } catch (err) {
      if (isYouTubeConnectionError(err)) {
        goToYouTubeSettings()
        return
      }
      const message =
        err instanceof Error
          ? err.message
          : t('features.dubbing.components.steps.videoInputStep.couldNotLoadYouTubeVideos')
      setMyVideosPermissionError(message)
    } finally {
      setRequestingMyVideos(false)
    }
  }

  const handleMyVideoSelect = async (video: MyVideoItem) => {
    const videoId = video.videoId
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
    setUrl(videoUrl)
    setLoading(true)
    setError(null)
    // 다른 영상 다시 선택하는 케이스 — 이전 영상의 자막 목록을 흘리지 않도록 먼저 비운다.
    setExistingCaptionLanguages([])
    try {
      setVideoSource({ type: 'channel', url: videoUrl, videoId })
      await importVideoByUrl(videoUrl)
      const currentMeta = useDubbingStore.getState().videoMeta
      if (currentMeta) {
        setVideoMeta({
          ...currentMeta,
          title: video.title || currentMeta.title,
          description: video.description || currentMeta.description,
        })
      }
      setUploadSettings({
        ...(video.title ? { title: video.title } : {}),
        ...(video.description ? { description: video.description } : {}),
      })

      // 내 영상의 기존 자막 트랙을 가져와 LanguageSelectStep에서 이미 자막이 있는 언어를
      // 비활성화한다. 실패해도 dubbing 흐름은 계속 진행 (자막 정보는 부가 정보).
      try {
        const captions = await ytListCaptions(videoId)
        const persoCodes = captions
          .map((c) => c.language?.trim())
          .filter((lang): lang is string => Boolean(lang))
          .map((lang) => fromBcp47(lang))
        setExistingCaptionLanguages(persoCodes)
      } catch (captionErr) {
        console.warn('[sub2tube] Failed to list existing captions', captionErr)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('features.dubbing.components.steps.videoInputStep.failedToImportTheVideo'))
    } finally {
      setLoading(false)
    }
  }

  const handleUrlSubmit = async () => {
    if (!isValidVideoUrl(url)) return
    setLoading(true)
    setError(null)
    // 외부 URL 입력은 내 영상이 아니라 기존 자막을 조회하지 않는다.
    setExistingCaptionLanguages([])
    try {
      setVideoSource({ type: 'url', url })
      await importVideoByUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('features.dubbing.components.steps.videoInputStep.failedToImportTheVideo2'))
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = async (file: File) => {
    setLoading(true)
    setError(null)
    setUploadProgress(10)
    // 신규 업로드라 기존 YouTube 자막이 존재할 수 없다.
    setExistingCaptionLanguages([])
    try {
      setVideoSource({ type: 'upload', file })
      setUploadProgress(30)
      await uploadLocalVideo(file)
      setUploadProgress(100)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('features.dubbing.components.steps.videoInputStep.uploadFailed'))
    } finally {
      setLoading(false)
      setUploadProgress(0)
    }
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  // Auto-detect shorts: ≤3min (YouTube Shorts 최대 길이)
  useEffect(() => {
    if (videoMeta) {
      const isShortCandidate = videoMeta.durationMs <= 180000
      setIsShort(isShortCandidate)
    }
  }, [videoMeta, setIsShort])

  const isValid = url.length > 0 && isValidVideoUrl(url)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Tabs
        defaultValue={initialTab}
        onChange={(value) => {
          setError(null)
          setActiveTab(value)
        }}
      >
        <TabsList className="mx-auto w-fit">
          <TabsTrigger value="upload">
            <span className="flex items-center gap-1.5"><Upload className="h-4 w-4" /> {t('features.dubbing.components.steps.videoInputStep.upload')}</span>
          </TabsTrigger>
          <TabsTrigger value="channel">
            <span className="flex items-center gap-1.5"><Film className="h-4 w-4" /> {t('features.dubbing.components.steps.videoInputStep.myVideos')}</span>
          </TabsTrigger>
          <TabsTrigger value="url">
            <span className="flex items-center gap-1.5"><Link2 className="h-4 w-4" /> {t('features.dubbing.components.steps.videoInputStep.videoURL')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="url" className="mt-6">
          <Card>
            <div className="mb-3 flex items-start gap-2 rounded-lg bg-blue-50 p-2.5 text-xs text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                {t('features.dubbing.components.steps.videoInputStep.onlyPublicVideosCanBeImportedForPrivate')}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  placeholder={t('features.dubbing.components.steps.videoInputStep.youTubeLinkOrDirectVideoLink')}
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setError(null) }}
                  icon={<Play className="h-4 w-4" />}
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                  error={error && !loading ? error : undefined}
                />
              </div>
              <Button
                onClick={handleUrlSubmit}
                loading={loading}
                disabled={!isValid || loading}
                className="shrink-0 whitespace-nowrap"
              >
                {loading ? t('features.dubbing.components.steps.videoInputStep.importing') : t('features.dubbing.components.steps.videoInputStep.import')}
              </Button>
            </div>
            {loading && (
              <p className="mt-2 text-xs text-ink-500 dark:text-paper-400">
                {isValidYouTubeUrl(url)
                  ? t('features.dubbing.components.steps.videoInputStep.importingFromYouTubeLongerVideosCanTakeA')
                  : t('features.dubbing.components.steps.videoInputStep.importingTheVideoFileLongerVideosCanTake')}
              </p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="upload" className="mt-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/mov,video/webm,.mp4,.mov,.webm"
            className="hidden"
            onChange={handleFileInputChange}
          />
          <Card
            role="button"
            tabIndex={0}
            aria-label={t('features.dubbing.components.steps.videoInputStep.selectVideoFile')}
            className="cursor-pointer border-2 border-dashed border-paper-300 text-center transition-colors hover:border-clay-400 focus-ring dark:border-paper-700"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => !loading && fileInputRef.current?.click()}
            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !loading) { e.preventDefault(); fileInputRef.current?.click() } }}
          >
            <div className="py-8">
              {loading ? (
                <>
                  <FileVideo className="mx-auto h-10 w-10 text-clay-500 animate-pulse" />
                  <p className="mt-3 text-sm font-medium text-ink-600 dark:text-ink-200">
                    {t('features.dubbing.components.steps.videoInputStep.uploadingVideo')}
                  </p>
                  <Progress value={uploadProgress} size="sm" className="mx-auto mt-3 max-w-xs" />
                </>
              ) : (
                <>
                  <Upload className="mx-auto h-10 w-10 text-ink-500 dark:text-paper-400" />
                  <p className="mt-3 text-sm font-medium text-ink-600 dark:text-ink-200">
                    {t('features.dubbing.components.steps.videoInputStep.dragAVideoHereOrClickToSelect')}
                  </p>
                  <p className="mt-1 text-xs text-ink-500 dark:text-paper-400">
                    {t('features.dubbing.components.steps.videoInputStep.mP4MOVAndWebMUpTo30Minutes')}
                  </p>
                </>
              )}
            </div>
          </Card>
          {error && !loading && (
            <p className="mt-2 text-sm text-red-500">{error}</p>
          )}
        </TabsContent>

        <TabsContent value="channel" className="mt-6">
          {channelLoading ? (
            <Card className="py-12 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-ink-500 dark:text-paper-400" />
              <p className="mt-3 text-sm text-ink-500 dark:text-ink-200">{t('features.dubbing.components.steps.videoInputStep.loadingChannelInformation')}</p>
            </Card>
          ) : isYouTubeConnectionError(channelError) ? (
            <Card className="py-12 text-center">
              <Film className="mx-auto h-10 w-10 text-ink-500 dark:text-paper-400" />
              <p className="mt-3 text-sm text-ink-500 dark:text-ink-200">{t('features.dubbing.components.steps.videoInputStep.connectYourYouTubeChannelToChooseFromYour')}</p>
              <Button variant="outline" className="mt-4" onClick={goToYouTubeSettings}>{t('features.dubbing.components.steps.videoInputStep.connectChannel')}</Button>
            </Card>
          ) : channelError ? (
            <Card className="py-12 text-center">
              <Film className="mx-auto h-10 w-10 text-ink-500 dark:text-paper-400" />
              <p className="mt-3 text-sm text-red-500">
                {channelError instanceof Error ? channelError.message : t('features.dubbing.components.steps.videoInputStep.couldNotLoadYouTubeChannelInformation')}
              </p>
            </Card>
          ) : !isConnected ? (
            <Card className="py-12 text-center">
              <Film className="mx-auto h-10 w-10 text-ink-500 dark:text-paper-400" />
              <p className="mt-3 text-sm text-ink-500 dark:text-ink-200">{t('features.dubbing.components.steps.videoInputStep.connectYourYouTubeChannelToChooseFromYour')}</p>
              <Button variant="outline" className="mt-4" onClick={goToYouTubeSettings}>{t('features.dubbing.components.steps.videoInputStep.connectChannel')}</Button>
            </Card>
          ) : !myVideosLoaded ? (
            <Card className="py-12 text-center">
              <Film className="mx-auto h-10 w-10 text-ink-500 dark:text-paper-400" />
              <p className="mt-3 text-sm text-ink-500 dark:text-ink-200">
                {t('features.dubbing.components.steps.videoInputStep.loadMyVideosDescription')}
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={handleLoadMyVideos}
                loading={myVideosLoading}
                disabled={myVideosLoading}
              >
                {t('features.dubbing.components.steps.videoInputStep.loadMyVideos')}
              </Button>
              {myVideosPermissionError && (
                <p className="mx-auto mt-3 max-w-md text-sm text-red-500">
                  {myVideosPermissionError}
                </p>
              )}
            </Card>
          ) : myVideosLoading ? (
            <Card className="py-12 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-ink-500 dark:text-paper-400" />
              <p className="mt-3 text-sm text-ink-500 dark:text-ink-200">{t('features.dubbing.components.steps.videoInputStep.loadingVideos')}</p>
            </Card>
          ) : isYouTubeConnectionError(myVideosError) ? (
            <Card className="py-12 text-center">
              <Film className="mx-auto h-10 w-10 text-ink-500 dark:text-paper-400" />
              <p className="mt-3 text-sm text-ink-500 dark:text-ink-200">{t('features.dubbing.components.steps.videoInputStep.connectYourYouTubeChannelToChooseFromYour')}</p>
              <Button variant="outline" className="mt-4" onClick={goToYouTubeSettings}>{t('features.dubbing.components.steps.videoInputStep.connectChannel')}</Button>
            </Card>
          ) : myVideosError ? (
            <Card className="py-12 text-center">
              <Film className="mx-auto h-10 w-10 text-ink-500 dark:text-paper-400" />
              <p className="mt-3 text-sm text-red-500">
                {myVideosError instanceof Error ? myVideosError.message : t('features.dubbing.components.steps.videoInputStep.couldNotLoadYouTubeVideos')}
              </p>
            </Card>
          ) : myVideos.length === 0 ? (
            <Card className="py-12 text-center">
              <Film className="mx-auto h-10 w-10 text-ink-500 dark:text-paper-400" />
              <p className="mt-3 text-sm text-ink-500 dark:text-ink-200">{t('features.dubbing.components.steps.videoInputStep.thereAreNoUploadedVideosOnThisChannel')}</p>
            </Card>
          ) : publicVideos.length === 0 ? (
            <Card className="py-12 text-center">
              <Lock className="mx-auto h-10 w-10 text-ink-500 dark:text-paper-400" />
              <p className="mt-3 text-sm text-ink-500 dark:text-ink-200">{t('features.dubbing.components.steps.videoInputStep.thereAreNoPublicVideosAvailableToImport')}</p>
              <p className="mt-1 text-xs text-ink-500 dark:text-paper-400">
                {t('features.dubbing.components.steps.videoInputStep.forPrivateOrUnlistedVideosUploadTheVideo')}
              </p>
            </Card>
          ) : (
            <Card>
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-paper-400" />
                <input
                  type="text"
                  value={videoSearch}
                  onChange={(e) => setVideoSearch(e.target.value)}
                  placeholder={t('features.dubbing.components.steps.videoInputStep.searchByVideoTitle')}
                  className="w-full rounded-md border border-paper-300 bg-paper-50 py-2 pl-9 pr-3 text-sm text-ink-900 focus:border-clay-500 focus:outline-none focus:ring-1 focus:ring-clay-500 dark:border-paper-700 dark:bg-paper-900 dark:text-ink-50"
                />
              </div>

              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {filteredVideos.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-500 dark:text-ink-200">{t('features.dubbing.components.steps.videoInputStep.noMatchingVideos')}</p>
                ) : (
                  filteredVideos.map((video) => (
                    <div
                      key={video.videoId}
                      className="flex items-center justify-between rounded-lg border border-paper-200 p-3 transition-colors hover:bg-paper-100 dark:border-paper-800 dark:hover:bg-paper-800/50"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {video.thumbnail ? (
                          <Image
                            src={video.thumbnail}
                            alt={video.title}
                            width={64}
                            height={36}
                            className="rounded object-cover shrink-0"
                          />
                        ) : (
                          <div className="flex h-9 w-16 shrink-0 items-center justify-center rounded bg-paper-100 dark:bg-paper-800">
                            <YouTubeLogo className="h-5 w-7" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-50">{video.title}</p>
                          <p className="text-xs text-ink-500 dark:text-ink-200">
                            {new Date(video.publishedAt).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US')}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 ml-3"
                        loading={loading}
                        disabled={loading}
                        onClick={() => handleMyVideoSelect(video)}
                      >
                        {t('features.dubbing.components.steps.videoInputStep.select')}
                      </Button>
                    </div>
                  ))
                )}
              </div>

              {hiddenCount > 0 && !videoSearch && (
                  <p className="mt-3 text-xs text-ink-500 dark:text-paper-400">
                  {t('features.dubbing.components.steps.videoInputStep.valuePrivateOrUnlistedVideosMustBeUploaded', { hiddenCount: hiddenCount })}
                </p>
              )}
              {error && !loading && (
                <p className="mt-3 text-sm text-red-500">{error}</p>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Video preview */}
      {videoMeta && !loading && (
        <Card className="animate-slide-up">
          <div className="flex gap-4">
            {videoMeta.thumbnail ? (
              <Image
                src={videoMeta.thumbnail.startsWith('http') ? videoMeta.thumbnail : getPersoFileUrl(videoMeta.thumbnail)}
                alt={videoMeta.title}
                width={128}
                height={80}
                className="shrink-0 rounded-lg object-cover bg-paper-200"
                unoptimized={!videoMeta.thumbnail.startsWith('http')}
              />
            ) : (
              <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded-lg bg-paper-100 dark:bg-paper-800">
                <YouTubeLogo className="h-8 w-12" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="min-w-0 flex-1 truncate font-semibold text-ink-900 dark:text-ink-50">{videoMeta.title}</h3>
                {videoMeta.durationMs <= 180000 && (
                  <Badge variant="brand" className="shrink-0">
                    <Zap className="h-3 w-3" /> {t('features.dubbing.components.steps.videoInputStep.shorts')}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-ink-500 dark:text-ink-200">{videoMeta.channelTitle}</p>
              {videoMeta.duration > 0 && (
                <p className="mt-1 text-xs text-ink-500 dark:text-paper-400">
                  {t('features.dubbing.components.steps.videoInputStep.durationLabel', {
                    duration: formatDuration(videoMeta.duration),
                  })}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={nextStep} disabled={!videoMeta || loading}>
          {t('features.dubbing.components.steps.videoInputStep.nextChooseLanguages')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
