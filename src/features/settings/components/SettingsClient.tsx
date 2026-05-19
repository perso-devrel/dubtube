'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, Globe, Globe2, Languages, Loader2, Save, Settings, Trash2, Unlink, Video } from 'lucide-react'
import { Card, CardTitle, Select, Button, Badge, Input, Modal } from '@/components/ui'
import {
  APP_LOCALE_LABELS,
  APP_LOCALES,
  CUSTOM_METADATA_TARGET_PRESET,
  getMarketLanguagePreset,
  getMetadataTargetLanguageCodes,
  MARKET_LANGUAGE_PRESETS,
  normalizeMetadataTargetLanguages,
  withLocalePath,
  type AppLocale,
} from '@/lib/i18n/config'
import { useI18nStore } from '@/stores/i18nStore'
import { useThemeStore, type ThemePreference } from '@/stores/themeStore'
import { useYouTubeSettingsStore } from '@/stores/youtubeSettingsStore'
import { SUPPORTED_LANGUAGES, getLanguageByCode } from '@/utils/languages'
import { useAppLocale, useLocaleText } from '@/hooks/useLocaleText'
import { useLocaleRouter } from '@/hooks/useLocalePath'
import { isYouTubeConnectionError, useChannelStats } from '@/hooks/useYouTubeData'
import { formatNumber } from '@/utils/formatters'
import { signInWithGoogle, signOut as clearStoredGoogleUser } from '@/lib/google-auth'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import type { PrivacyStatus } from '@/features/dubbing/types/dubbing.types'
import { saveUserPreferences } from '@/lib/api-client/user-preferences'

const APP_LOCALE_OPTIONS = APP_LOCALES.map((locale) => ({
  value: locale,
  label: `${APP_LOCALE_LABELS[locale].nativeLabel} / ${APP_LOCALE_LABELS[locale].label}`,
}))

function formatTags(tags: readonly string[]) {
  return tags.join(', ')
}

function parseTagsInput(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function sameLanguageSet(a: readonly string[], b: readonly string[]) {
  if (a.length !== b.length) return false
  const bSet = new Set(b)
  return a.every((code) => bSet.has(code))
}

function orderLanguageCodes(codes: readonly string[]) {
  const selected = new Set(codes)
  return SUPPORTED_LANGUAGES
    .filter((language) => selected.has(language.code))
    .map((language) => language.code)
}

function resolvePresetForLanguageSet(languageCodes: readonly string[]) {
  return MARKET_LANGUAGE_PRESETS.find((preset) => sameLanguageSet(preset.languageCodes, languageCodes))
}

export function SettingsClient() {
  const t = useLocaleText()
  const {
    metadataTargetPreset,
    metadataTargetLanguages,
    setAppLocale,
    setMetadataTargetPreset,
    setMetadataTargetLanguages,
  } = useI18nStore()
  const { preference: themePreference, setPreference: setThemePreference } = useThemeStore()
  const appLocale = useAppLocale()
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const addToast = useNotificationStore((state) => state.addToast)
  const {
    defaultPrivacy,
    defaultLanguage,
    defaultTags,
    setDefaultPrivacy,
    setDefaultLanguage,
    setDefaultTags,
  } = useYouTubeSettingsStore()
  const localeRouter = useLocaleRouter()
  const isEnglish = appLocale === 'en'
  const languageOptions = SUPPORTED_LANGUAGES.map((language) => ({
    value: language.code,
    label: isEnglish
      ? `${language.flag} ${language.name} (${language.nativeName})`
      : `${language.flag} ${language.nativeName} (${language.name})`,
  }))
  const [draftAppLocale, setDraftAppLocale] = useState<AppLocale>(appLocale)
  const [draftDefaultPrivacy, setDraftDefaultPrivacy] = useState<PrivacyStatus>(defaultPrivacy)
  const [draftDefaultLanguage, setDraftDefaultLanguage] = useState(defaultLanguage)
  const [draftMetadataTargetPreset, setDraftMetadataTargetPreset] = useState(metadataTargetPreset)
  const [draftMetadataTargetLanguages, setDraftMetadataTargetLanguages] = useState<string[]>(
    () => getMetadataTargetLanguageCodes(metadataTargetPreset, metadataTargetLanguages),
  )
  const [defaultTagsInput, setDefaultTagsInput] = useState(() => formatTags(defaultTags))
  const [languageModalOpen, setLanguageModalOpen] = useState(false)
  const [modalLanguageCodes, setModalLanguageCodes] = useState<string[]>(
    () => getMetadataTargetLanguageCodes(metadataTargetPreset, metadataTargetLanguages),
  )
  const youtubeSectionRef = useRef<HTMLDivElement>(null)

  const { data: channel, error: channelError } = useChannelStats()
  const isYouTubeConnected = !!channel && !isYouTubeConnectionError(channelError)

  const draftTags = useMemo(() => parseTagsInput(defaultTagsInput), [defaultTagsInput])
  const targetLanguageCodes = useMemo(
    () => getMetadataTargetLanguageCodes(draftMetadataTargetPreset, draftMetadataTargetLanguages),
    [draftMetadataTargetLanguages, draftMetadataTargetPreset],
  )
  const selectedPreset = getMarketLanguagePreset(draftMetadataTargetPreset)
  const presetLanguages = targetLanguageCodes.map((code) => getLanguageByCode(code)).filter(Boolean)
  const persistedPreferenceSnapshot = useMemo(() => ({
    appLocale,
    metadataTargetPreset,
    metadataTargetLanguages: getMetadataTargetLanguageCodes(metadataTargetPreset, metadataTargetLanguages),
    defaultPrivacy,
    defaultLanguage,
    defaultTags,
  }), [appLocale, defaultLanguage, defaultPrivacy, defaultTags, metadataTargetLanguages, metadataTargetPreset])
  const draftPreferenceSnapshot = useMemo(() => ({
    appLocale: draftAppLocale,
    metadataTargetPreset: draftMetadataTargetPreset,
    metadataTargetLanguages: targetLanguageCodes,
    defaultPrivacy: draftDefaultPrivacy,
    defaultLanguage: draftDefaultLanguage,
    defaultTags: draftTags,
  }), [
    draftAppLocale,
    draftDefaultLanguage,
    draftDefaultPrivacy,
    draftMetadataTargetPreset,
    draftTags,
    targetLanguageCodes,
  ])
  const hasPendingPreferenceChanges = JSON.stringify(persistedPreferenceSnapshot) !== JSON.stringify(draftPreferenceSnapshot)
  const selectedModalPresetId = resolvePresetForLanguageSet(modalLanguageCodes)?.id ?? null

  const saveMutation = useMutation({ mutationFn: saveUserPreferences })

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('section') !== 'youtube') return
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        youtubeSectionRef.current?.scrollIntoView({ block: 'start' })
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDraftAppLocale(appLocale)
      setDraftDefaultPrivacy(defaultPrivacy)
      setDraftDefaultLanguage(defaultLanguage)
      setDraftMetadataTargetPreset(metadataTargetPreset)
      setDraftMetadataTargetLanguages(getMetadataTargetLanguageCodes(metadataTargetPreset, metadataTargetLanguages))
      setDefaultTagsInput(formatTags(defaultTags))
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [appLocale, defaultLanguage, defaultPrivacy, defaultTags, metadataTargetLanguages, metadataTargetPreset])

  const openLaunchLanguageModal = () => {
    setModalLanguageCodes(targetLanguageCodes)
    setLanguageModalOpen(true)
  }

  const toggleModalLanguage = (code: string) => {
    setModalLanguageCodes((current) => {
      if (current.includes(code)) {
        if (current.length <= 1) return current
        return current.filter((item) => item !== code)
      }
      return orderLanguageCodes([...current, code])
    })
  }

  const applyLanguagePreset = (languageCodes: readonly string[]) => {
    setModalLanguageCodes(orderLanguageCodes(languageCodes))
  }

  const applyLaunchLanguages = () => {
    const normalized = normalizeMetadataTargetLanguages(modalLanguageCodes)
    const matchedPreset = resolvePresetForLanguageSet(normalized)
    setDraftMetadataTargetLanguages(normalized)
    setDraftMetadataTargetPreset(matchedPreset?.id ?? CUSTOM_METADATA_TARGET_PRESET)
    setLanguageModalOpen(false)
  }

  const savePreferences = async () => {
    try {
      const saved = await saveMutation.mutateAsync(draftPreferenceSnapshot)
      queryClient.setQueryData(['user-preferences', user?.uid ?? null], saved)
      setDefaultPrivacy(saved.defaultPrivacy)
      setDefaultLanguage(saved.defaultLanguage)
      setDefaultTags(saved.defaultTags)
      setAppLocale(saved.appLocale)
      setMetadataTargetPreset(saved.metadataTargetPreset)
      setMetadataTargetLanguages(saved.metadataTargetLanguages)
      setDefaultTagsInput(formatTags(saved.defaultTags))
      addToast({ type: 'success', title: t('settings.preferences.saved') })
      if (saved.appLocale !== appLocale) {
        localeRouter.replaceLocale(saved.appLocale)
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: t('settings.preferences.saveFailed'),
        message: error instanceof Error ? error.message : t('common.unknownError'),
      })
    }
  }

  return (
    <div className="space-y-4">
      <div ref={youtubeSectionRef} id="youtube-settings" className="scroll-mt-20">
        <YouTubeConnectionCard />
      </div>

      {isYouTubeConnected && (
        <Card>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-clay-50 text-clay-600 dark:bg-clay-800/20 dark:text-clay-200">
              <Video className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{t('settings.youtubeDefaults.title')}</CardTitle>
              <p className="mt-1 text-sm text-ink-500 dark:text-paper-400">
                {t('settings.youtubeDefaults.description')}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label={t('app.app.youtube.page.defaultVisibility')}
              value={draftDefaultPrivacy}
              onChange={(event) => setDraftDefaultPrivacy(event.target.value as PrivacyStatus)}
              options={[
                { value: 'public', label: t('app.app.youtube.page.public') },
                { value: 'unlisted', label: t('app.app.youtube.page.unlisted') },
                { value: 'private', label: t('app.app.youtube.page.private') },
              ]}
            />
            <Input
              label={t('app.app.youtube.page.defaultTags')}
              value={defaultTagsInput}
              onChange={(event) => setDefaultTagsInput(event.target.value)}
              placeholder={t('app.app.youtube.page.commaSeparatedEGDubtubeAIDubbingVlog')}
            />
            <div className="md:col-span-2">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-ink-600 dark:text-ink-200">
                  {t('settings.launchLanguageSelection')}
                </label>
                <Button type="button" variant="outline" size="sm" onClick={openLaunchLanguageModal}>
                  <Languages className="h-4 w-4" />
                  {t('settings.launchLanguageSelection.edit')}
                </Button>
              </div>
              <div className="rounded-lg border border-paper-200 bg-paper-100 p-3 dark:border-paper-700 dark:bg-paper-900">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink-900 dark:text-ink-50">
                      {t(selectedPreset.labelKey)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-ink-500 dark:text-ink-200">
                      {t('settings.launchLanguageSelection.selectedCount', { count: targetLanguageCodes.length })}
                    </p>
                  </div>
                  <Badge variant="brand">{t(selectedPreset.labelKey)}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {presetLanguages.map((language) => language && (
                    <span
                      key={language.code}
                      className="max-w-full rounded-full bg-paper-50 px-2.5 py-1 text-xs font-medium text-ink-600 ring-1 ring-paper-200 dark:bg-paper-900 dark:text-ink-100 dark:ring-paper-700"
                    >
                      {language.flag} {isEnglish ? language.name : language.nativeName}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-clay-50 text-clay-600 dark:bg-clay-800/20 dark:text-clay-200">
            <Globe2 className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>{t('settings.languageDefaults.title')}</CardTitle>
            <p className="mt-1 text-sm text-ink-500 dark:text-paper-400">
              {t('settings.languageDefaults.description')}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label={t('settings.appLocale')}
            value={draftAppLocale}
            onChange={(event) => {
              const nextLocale = event.target.value as AppLocale
              setDraftAppLocale(nextLocale)
            }}
            options={APP_LOCALE_OPTIONS}
          />
          <Select
            label={t('settings.themeMode')}
            value={themePreference}
            onChange={(event) => setThemePreference(event.target.value as ThemePreference)}
            options={[
              { value: 'system', label: t('settings.themeMode.system') },
              { value: 'light', label: t('settings.themeMode.light') },
              { value: 'dark', label: t('settings.themeMode.dark') },
            ]}
          />
          <Select
            label={t('settings.metadataLanguage')}
            value={draftDefaultLanguage}
            onChange={(event) => setDraftDefaultLanguage(event.target.value)}
            options={languageOptions}
          />
        </div>
      </Card>

      {hasPendingPreferenceChanges && (
        <div className="flex flex-col gap-3 rounded-lg border border-clay-200 bg-clay-50 p-3 dark:border-clay-500/60 dark:bg-paper-900 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-clay-700 dark:text-ink-50">
            {t('settings.preferences.unsavedChanges')}
          </p>
          <Button onClick={savePreferences} loading={saveMutation.isPending} className="w-full sm:w-auto">
            <Save className="h-4 w-4" />
            {t('settings.preferences.saveChanges')}
          </Button>
        </div>
      )}

      <AccountDangerZone />

      <Modal
        open={languageModalOpen}
        onClose={() => setLanguageModalOpen(false)}
        title={t('settings.launchLanguages.modalTitle')}
        size="xl"
      >
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium text-ink-700 dark:text-ink-50">
              {t('settings.launchLanguages.presets')}
            </p>
            <div className="grid gap-2 md:grid-cols-3">
              {MARKET_LANGUAGE_PRESETS.map((preset) => {
                const active = selectedModalPresetId === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyLanguagePreset(preset.languageCodes)}
                    className={`rounded-lg border p-3 text-left transition focus-ring ${
                      active
                        ? 'border-clay-500 bg-clay-50 text-clay-800 dark:border-clay-400 dark:bg-paper-800 dark:text-ink-50'
                        : 'border-paper-200 bg-paper-50 text-ink-700 hover:bg-paper-100 dark:border-paper-600 dark:bg-paper-900 dark:text-ink-50 dark:hover:bg-paper-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{t(preset.labelKey)}</span>
                      {active && <Check className="h-4 w-4" />}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-500 dark:text-ink-200">
                      {t(preset.descriptionKey)}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-ink-700 dark:text-ink-50">
                {t('settings.launchLanguages.allLanguages')}
              </p>
              <Badge variant="brand">
                {t('settings.launchLanguageSelection.selectedCount', { count: modalLanguageCodes.length })}
              </Badge>
            </div>
            <div className="grid max-h-[320px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {SUPPORTED_LANGUAGES.map((language) => {
                const selected = modalLanguageCodes.includes(language.code)
                return (
                  <button
                    key={language.code}
                    type="button"
                    onClick={() => toggleModalLanguage(language.code)}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition focus-ring ${
                      selected
                        ? 'border-clay-400 bg-clay-50 text-clay-700 dark:border-clay-400 dark:bg-paper-800 dark:text-ink-50'
                        : 'border-paper-200 bg-paper-50 text-ink-600 hover:bg-paper-100 dark:border-paper-600 dark:bg-paper-900 dark:text-ink-100 dark:hover:bg-paper-800'
                    }`}
                  >
                    <span className="min-w-0 truncate">
                      {language.flag} {isEnglish ? `${language.name} (${language.nativeName})` : `${language.nativeName} (${language.name})`}
                    </span>
                    {selected && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setLanguageModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={applyLaunchLanguages}>
              <Check className="h-4 w-4" />
              {t('settings.launchLanguages.applySelection')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

const ACCOUNT_DELETE_CONFIRMATION = 'DELETE'

function AccountDangerZone() {
  const t = useLocaleText()
  const appLocale = useAppLocale()
  const queryClient = useQueryClient()
  const clearAuth = useAuthStore((s) => s.clear)
  const addToast = useNotificationStore((state) => state.addToast)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const confirmationMatches = confirmation.trim() === ACCOUNT_DELETE_CONFIRMATION

  const closeDeleteModal = () => {
    if (deleting) return
    setDeleteModalOpen(false)
    setConfirmation('')
  }

  const handleDeleteAccount = async () => {
    if (!confirmationMatches) return
    setDeleting(true)
    try {
      const res = await fetch('/api/user/account', { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: { message?: string } } | null
        throw new Error(body?.error?.message || t('settings.accountDeletion.failedMessage'))
      }
      clearStoredGoogleUser()
      clearAuth()
      queryClient.clear()
      window.location.replace(withLocalePath('/', appLocale))
    } catch (error) {
      addToast({
        type: 'error',
        title: t('settings.accountDeletion.failed'),
        message: error instanceof Error ? error.message : t('settings.accountDeletion.failedMessage'),
      })
      setDeleting(false)
    }
  }

  return (
    <>
      <Card className="border-red-200 dark:border-red-900/70">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle>{t('settings.dangerZone.title')}</CardTitle>
            </div>
          </div>
          <Button type="button" variant="destructive" onClick={() => setDeleteModalOpen(true)} className="w-full sm:w-auto">
            <Trash2 className="h-4 w-4" />
            {t('settings.accountDeletion.button')}
          </Button>
        </div>
      </Card>

      <Modal
        open={deleteModalOpen}
        onClose={closeDeleteModal}
        title={t('settings.accountDeletion.modalTitle')}
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-ink-600 dark:text-ink-200">
            {t('settings.accountDeletion.modalDescription')}
          </p>
          <Input
            label={t('settings.accountDeletion.confirmLabel', { confirmation: ACCOUNT_DELETE_CONFIRMATION })}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={ACCOUNT_DELETE_CONFIRMATION}
            autoComplete="off"
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeDeleteModal} disabled={deleting}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteAccount}
              loading={deleting}
              disabled={!confirmationMatches}
            >
              <Trash2 className="h-4 w-4" />
              {t('settings.accountDeletion.confirmButton')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

function YouTubeConnectionCard() {
  const t = useLocaleText()
  const [disconnecting, setDisconnecting] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const addToast = useNotificationStore((state) => state.addToast)
  const { data: channel, isLoading: channelLoading, error: channelError } = useChannelStats()
  const missingYouTubeConnection = isYouTubeConnectionError(channelError)
  const isConnected = !!channel && !missingYouTubeConnection
  const connectionMessage = t('app.app.youtube.page.youTubeConnectionRequired')

  const handleReconnect = async () => {
    setConnecting(true)
    try {
      await signInWithGoogle({
        forceConsent: true,
        scopeMode: 'youtube-write',
        returnTo: '/settings?section=youtube',
      })
      // Page navigates to Google; control never returns here on success.
    } catch {
      addToast({
        type: 'error',
        title: t('app.app.youtube.page.couldNotConnectYouTube'),
        message: t('app.app.youtube.page.pleaseTryAgainShortly'),
      })
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/auth/disconnect-youtube', { method: 'POST' })
      if (!res.ok) throw new Error('disconnect failed')
      window.location.reload()
    } catch {
      addToast({
        type: 'error',
        title: t('app.app.youtube.page.couldNotDisconnect'),
        message: t('app.app.youtube.page.pleaseTryAgainShortly'),
      })
      setDisconnecting(false)
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Settings className="h-5 w-5 text-paper-400" />
        <CardTitle>{t('app.app.youtube.page.connectedChannel')}</CardTitle>
      </div>

      {channelLoading ? (
        <div className="mt-4 flex items-center gap-2 text-ink-500 dark:text-ink-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{t('app.app.youtube.page.loadingChannelInformation')}</span>
        </div>
      ) : channelError && !missingYouTubeConnection ? (
        <div className="mt-4 flex flex-col items-center gap-3 py-8">
          <Video className="h-12 w-12 text-ink-200" />
          <p className="text-sm text-red-500">
            {channelError instanceof Error ? channelError.message : t('app.app.youtube.page.couldNotLoadYouTubeChannelInformation')}
          </p>
        </div>
      ) : isConnected ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {channel.thumbnail ? (
              <Image
                src={channel.thumbnail}
                alt={channel.title}
                width={48}
                height={48}
                className="rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-clay-500 text-lg font-bold text-paper-50">
                {channel.title[0]?.toUpperCase() || 'Y'}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink-900 dark:text-ink-50">{channel.title}</p>
              <p className="text-sm text-ink-500 dark:text-ink-200">
                {t('app.app.youtube.page.valueSubscribersValueVideos', {
                  formatNumberChannelSubscriberCount: formatNumber(channel.subscriberCount),
                  formatNumberChannelVideoCount: formatNumber(channel.videoCount),
                })}
              </p>
            </div>
            <Badge variant="success">{t('app.app.youtube.page.connected')}</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={handleDisconnect} loading={disconnecting} className="w-full sm:w-auto">
            <Unlink className="h-4 w-4" />
            {t('app.app.youtube.page.disconnectYouTube')}
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-4 py-8">
          <Video className="h-12 w-12 text-ink-200" />
          <p className="max-w-md text-center text-sm leading-6 text-ink-500 dark:text-ink-200">{connectionMessage}</p>
          <p className="max-w-md whitespace-pre-line text-center text-xs leading-5 text-ink-500 dark:text-ink-200">
            {t('app.app.youtube.page.dubtubeRequestsYouTubePermissionsForChannelReadsUploads')}
          </p>
          <Button onClick={handleReconnect} loading={connecting}>
            <Globe className="h-4 w-4" />
            {t('app.app.youtube.page.connectYouTubeWithGoogle')}
          </Button>
        </div>
      )}
    </Card>
  )
}
