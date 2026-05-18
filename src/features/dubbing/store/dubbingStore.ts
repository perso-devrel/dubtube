'use client'

import { create } from 'zustand'
import { useYouTubeSettingsStore } from '@/stores/youtubeSettingsStore'
import { getDefaultPublishTimeZone } from '@/lib/youtube/publish-schedule'
import { DEFAULT_YOUTUBE_CATEGORY_ID } from '@/lib/youtube/upload-options'
import type {
  DubbingStep,
  VideoSource,
  VideoMetadata,
  TranslationSegment,
  LanguageProgress,
  GlossaryEntry,
  JobStatus,
  UploadSettings,
  DeliverableMode,
  PrivacyStatus,
  YouTubeUploadState,
} from '../types/dubbing.types'

// YouTube 설정 페이지의 기본값을 그때그때 가져온다.
// SSR 단계에서는 localStorage가 없으므로 fallback 사용.
const readDefaultPrivacy = (): PrivacyStatus => {
  if (typeof window === 'undefined') return 'private'
  try {
    return useYouTubeSettingsStore.getState().defaultPrivacy
  } catch {
    return 'private'
  }
}

const readDefaultLanguage = (): string => {
  if (typeof window === 'undefined') return 'ko'
  try {
    return useYouTubeSettingsStore.getState().defaultLanguage
  } catch {
    return 'ko'
  }
}

const FALLBACK_DEFAULT_TAGS = ['sub2tube', 'AI더빙', 'dubbed']

const readDefaultTags = (): string[] => {
  if (typeof window === 'undefined') return [...FALLBACK_DEFAULT_TAGS]
  try {
    const stored = useYouTubeSettingsStore.getState().defaultTags
    return Array.isArray(stored) ? [...stored] : [...FALLBACK_DEFAULT_TAGS]
  } catch {
    return [...FALLBACK_DEFAULT_TAGS]
  }
}

const buildDefaultUploadSettings = (): UploadSettings => ({
  autoUpload: true,
  attachOriginalLink: true,
  title: '',
  description: '',
  tags: readDefaultTags(),
  categoryId: DEFAULT_YOUTUBE_CATEGORY_ID,
  privacyStatus: readDefaultPrivacy(),
  publishAt: null,
  publishAtTimeZone: getDefaultPublishTimeZone(),
  notifySubscribers: true,
  thumbnailUrl: '',
  playlistIds: [],
  uploadCaptions: true,
  selfDeclaredMadeForKids: false,
  containsSyntheticMedia: true,
  uploadReviewConfirmed: false,
  metadataLanguage: readDefaultLanguage(),
})

const REVIEW_RESET_FIELDS: Array<keyof UploadSettings> = [
  'autoUpload',
  'attachOriginalLink',
  'title',
  'description',
  'tags',
  'categoryId',
  'privacyStatus',
  'publishAt',
  'publishAtTimeZone',
  'notifySubscribers',
  'thumbnailUrl',
  'playlistIds',
  'metadataLanguage',
  'uploadCaptions',
  'selfDeclaredMadeForKids',
  'containsSyntheticMedia',
]

interface DubbingState {
  // Wizard navigation
  currentStep: DubbingStep
  setStep: (step: DubbingStep) => void
  nextStep: () => void
  prevStep: () => void

  // Submission guard — persists across component remounts
  isSubmitted: boolean
  setIsSubmitted: (v: boolean) => void

  // Perso context
  spaceSeq: number | null
  mediaSeq: number | null
  setSpaceSeq: (seq: number) => void
  setMediaSeq: (seq: number) => void

  // Step 1: Video source
  videoSource: VideoSource | null
  videoMeta: VideoMetadata | null
  originalVideoUrl: string | null
  /**
   * '내 영상' 모드에서 선택된 YouTube 영상에 이미 등록된 자막 언어 코드.
   * Perso 코드 기준(예: 'en','ko','pt-BR' → 'en','ko','pt' 변환 후 저장).
   * LanguageSelectStep에서 해당 언어는 비활성화한다.
   */
  existingCaptionLanguages: string[]
  setVideoSource: (source: VideoSource) => void
  setVideoMeta: (meta: VideoMetadata) => void
  setOriginalVideoUrl: (url: string) => void
  setExistingCaptionLanguages: (codes: string[]) => void

  // Step 2: Language selection
  sourceLanguage: string
  selectedLanguages: string[]
  lipSyncEnabled: boolean
  numberOfSpeakers: number
  setSourceLanguage: (code: string) => void
  toggleLanguage: (code: string) => void
  setSelectedLanguages: (codes: string[]) => void
  setLipSync: (enabled: boolean) => void
  setNumberOfSpeakers: (n: number) => void

  // Step 3: Deliverable mode
  deliverableMode: DeliverableMode
  copyrightAcknowledged: boolean
  setDeliverableMode: (mode: DeliverableMode) => void
  setCopyrightAcknowledged: (v: boolean) => void

  // Step 5: Translation review
  segments: Record<string, TranslationSegment[]>
  setSegments: (langCode: string, segments: TranslationSegment[]) => void
  updateSegment: (langCode: string, segmentId: string, text: string) => void
  toggleExcludeSegment: (langCode: string, segmentId: string) => void

  // Step 6: Processing — maps langCode to projectSeq
  projectMap: Record<string, number>
  jobStatus: JobStatus
  languageProgress: LanguageProgress[]
  setProjectMap: (map: Record<string, number>) => void
  setJobStatus: (status: JobStatus) => void
  setLanguageProgress: (progress: LanguageProgress[]) => void
  updateLanguageProgress: (langCode: string, update: Partial<LanguageProgress>) => void

  // Step 7: YouTube upload state — persists across route navigation until reset.
  youtubeUploads: Record<string, YouTubeUploadState>
  setYouTubeUploadState: (langCode: string, state: YouTubeUploadState) => void

  // DB
  dbJobId: number | null
  setDbJobId: (id: number) => void

  // Shorts
  isShort: boolean
  setIsShort: (v: boolean) => void

  // Upload settings (chosen before dubbing starts)
  uploadSettings: UploadSettings
  /** Wizard 세션 내에서 사용자가 privacyStatus를 직접 변경했는지 여부.
   * true이면 YouTube 설정 페이지의 글로벌 기본값으로 덮어쓰지 않는다. */
  privacyOverridden: boolean
  /** Wizard 세션 내에서 사용자가 metadataLanguage를 직접 변경했는지 여부. */
  metadataLanguageOverridden: boolean
  /** Wizard 세션 내에서 사용자가 tags를 직접 변경했는지 여부. */
  tagsOverridden: boolean
  setUploadSettings: (patch: Partial<UploadSettings>) => void
  /** YouTube 설정 페이지의 기본값을 wizard에 동기화한다 (사용자 override 없을 때만). */
  syncPrivacyFromGlobalDefault: () => void
  syncMetadataLanguageFromGlobalDefault: () => void
  syncTagsFromGlobalDefault: () => void

  // Glossary
  glossary: GlossaryEntry[]
  addGlossaryEntry: (entry: GlossaryEntry) => void
  removeGlossaryEntry: (id: string) => void

  // Reset
  reset: () => void
}

const initialState = {
  currentStep: 1 as DubbingStep,
  isSubmitted: false,
  spaceSeq: null as number | null,
  mediaSeq: null as number | null,
  videoSource: null as VideoSource | null,
  videoMeta: null as VideoMetadata | null,
  originalVideoUrl: null as string | null,
  existingCaptionLanguages: [] as string[],
  sourceLanguage: 'auto',
  selectedLanguages: [] as string[],
  lipSyncEnabled: false,
  numberOfSpeakers: 1,
  isShort: false,
  segments: {} as Record<string, TranslationSegment[]>,
  projectMap: {} as Record<string, number>,
  youtubeUploads: {} as Record<string, YouTubeUploadState>,
  dbJobId: null as number | null,
  jobStatus: 'idle' as JobStatus,
  languageProgress: [] as LanguageProgress[],
  glossary: [] as GlossaryEntry[],
  deliverableMode: 'newDubbedVideos' as DeliverableMode,
  copyrightAcknowledged: false,
  uploadSettings: buildDefaultUploadSettings() as UploadSettings,
  privacyOverridden: false,
  metadataLanguageOverridden: false,
  tagsOverridden: false,
}

export const useDubbingStore = create<DubbingState>((set) => ({
  ...initialState,

  setStep: (step) => set({ currentStep: step }),
  setIsSubmitted: (v) => set({ isSubmitted: v }),
  nextStep: () => set((s) => {
    let next = s.currentStep + 1
    if (next === 4 && s.deliverableMode === 'downloadOnly') next = 5
    return { currentStep: Math.min(7, next) as DubbingStep }
  }),
  prevStep: () => set((s) => {
    let prev = s.currentStep - 1
    if (prev === 4 && s.deliverableMode === 'downloadOnly') prev = 3
    return { currentStep: Math.max(1, prev) as DubbingStep }
  }),

  setSpaceSeq: (seq) => set({ spaceSeq: seq }),
  setMediaSeq: (seq) => set({ mediaSeq: seq }),

  setVideoSource: (source) => set({ videoSource: source }),
  setVideoMeta: (meta) => set({ videoMeta: meta }),
  setOriginalVideoUrl: (url) => set({ originalVideoUrl: url }),
  setExistingCaptionLanguages: (codes) =>
    set({ existingCaptionLanguages: Array.from(new Set(codes)) }),

  setSourceLanguage: (code) =>
    set((s) => ({
      sourceLanguage: code,
      // Target list must not include the source language
      selectedLanguages: s.selectedLanguages.filter((l) => l !== code),
    })),
  toggleLanguage: (code) =>
    set((s) => ({
      selectedLanguages: s.selectedLanguages.includes(code)
        ? s.selectedLanguages.filter((l) => l !== code)
        : [...s.selectedLanguages, code],
    })),
  setSelectedLanguages: (codes) =>
    set((s) => ({
      selectedLanguages: Array.from(new Set(codes)).filter((c) => c !== s.sourceLanguage),
    })),
  setLipSync: (enabled) => set({ lipSyncEnabled: enabled }),
  setNumberOfSpeakers: (n) =>
    set({ numberOfSpeakers: Math.max(1, Math.min(10, Math.floor(n))) }),

  setSegments: (langCode, segments) =>
    set((s) => ({ segments: { ...s.segments, [langCode]: segments } })),
  updateSegment: (langCode, segmentId, text) =>
    set((s) => ({
      segments: {
        ...s.segments,
        [langCode]: (s.segments[langCode] || []).map((seg) =>
          seg.id === segmentId ? { ...seg, translatedText: text } : seg,
        ),
      },
    })),
  toggleExcludeSegment: (langCode, segmentId) =>
    set((s) => ({
      segments: {
        ...s.segments,
        [langCode]: (s.segments[langCode] || []).map((seg) =>
          seg.id === segmentId ? { ...seg, excluded: !seg.excluded } : seg,
        ),
      },
    })),

  setProjectMap: (map) => set({ projectMap: map }),
  setJobStatus: (status) => set({ jobStatus: status }),
  setLanguageProgress: (progress) => set({ languageProgress: progress }),
  updateLanguageProgress: (langCode, update) =>
    set((s) => ({
      languageProgress: s.languageProgress.map((lp) =>
        lp.langCode === langCode ? { ...lp, ...update } : lp,
      ),
    })),
  setYouTubeUploadState: (langCode, state) =>
    set((s) => ({
      youtubeUploads: { ...s.youtubeUploads, [langCode]: state },
    })),

  setDbJobId: (id) => set({ dbJobId: id }),
  setIsShort: (v) => set({ isShort: v }),

  setDeliverableMode: (mode) => set({ deliverableMode: mode }),
  setCopyrightAcknowledged: (v) => set({ copyrightAcknowledged: v }),

  setUploadSettings: (patch) => set((s) => {
    const shouldResetReview = REVIEW_RESET_FIELDS.some((field) => patch[field] !== undefined)
    return {
      uploadSettings: {
        ...s.uploadSettings,
        ...patch,
        uploadReviewConfirmed:
          patch.uploadReviewConfirmed ?? (shouldResetReview ? false : s.uploadSettings.uploadReviewConfirmed),
      },
      privacyOverridden:
        patch.privacyStatus !== undefined ? true : s.privacyOverridden,
      metadataLanguageOverridden:
        patch.metadataLanguage !== undefined ? true : s.metadataLanguageOverridden,
      tagsOverridden:
        patch.tags !== undefined ? true : s.tagsOverridden,
    }
  }),

  syncPrivacyFromGlobalDefault: () => set((s) => {
    if (s.privacyOverridden) return s
    const next = readDefaultPrivacy()
    if (s.uploadSettings.privacyStatus === next) return s
    return {
      uploadSettings: { ...s.uploadSettings, privacyStatus: next, uploadReviewConfirmed: false },
    }
  }),

  syncMetadataLanguageFromGlobalDefault: () => set((s) => {
    if (s.metadataLanguageOverridden) return s
    const next = readDefaultLanguage()
    if (s.uploadSettings.metadataLanguage === next) return s
    return {
      uploadSettings: { ...s.uploadSettings, metadataLanguage: next, uploadReviewConfirmed: false },
    }
  }),

  syncTagsFromGlobalDefault: () => set((s) => {
    if (s.tagsOverridden) return s
    const next = readDefaultTags()
    const current = s.uploadSettings.tags
    if (current.length === next.length && current.every((tag, index) => tag === next[index])) return s
    return {
      uploadSettings: { ...s.uploadSettings, tags: next, uploadReviewConfirmed: false },
    }
  }),

  addGlossaryEntry: (entry) => set((s) => ({ glossary: [...s.glossary, entry] })),
  removeGlossaryEntry: (id) => set((s) => ({ glossary: s.glossary.filter((e) => e.id !== id) })),

  reset: () => set({ ...initialState, uploadSettings: buildDefaultUploadSettings() }),
}))
