import type { AppLocale } from './config'
import { text, type LocalizedText } from './text'
import { generatedMessages } from './generatedMessages'

const baseMessages = {
  'common.loading': { ko: '불러오는 중...', en: 'Loading...' },
  'common.retry': { ko: '다시 시도', en: 'Try again' },
  'common.cancel': { ko: '취소', en: 'Cancel' },
  'common.delete': { ko: '삭제', en: 'Delete' },
  'common.close': { ko: '닫기', en: 'Close' },
  'common.save': { ko: '저장', en: 'Save' },
  'common.done': { ko: '완료', en: 'Done' },
  'common.minutes.value': { ko: '{count}분', en: '{count} min' },
  'privacyStatus.private': { ko: '비공개', en: 'Private' },
  'privacyStatus.unlisted': { ko: '일부 공개', en: 'Unlisted' },
  'privacyStatus.public': { ko: '공개', en: 'Public' },
  'common.unknownError': {
    ko: '문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    en: 'Something went wrong. Please try again shortly.',
  },
  'common.supportCode': { ko: '문의 시 전달할 오류 코드', en: 'Support code' },
  'status.queued': { ko: '대기 중', en: 'Queued' },
  'status.processing': { ko: '처리 중', en: 'Processing' },
  'status.complete': { ko: '완료', en: 'Complete' },
  'status.failed': { ko: '실패', en: 'Failed' },
  'settings.languageDefaults.title': {
    ko: '기본 설정',
    en: 'Preferences',
  },
  'settings.languageDefaults.description': {
    ko: '화면 언어와 테마, 제목·설명 기본 언어를 정합니다.',
    en: 'Set display language, theme, and default metadata language.',
  },
  'settings.youtubeDefaults.title': {
    ko: 'YouTube 업로드 기본값',
    en: 'YouTube upload defaults',
  },
  'settings.youtubeDefaults.description': {
    ko: '새 작업에 적용할 공개 범위, 태그, 출시 언어를 정합니다. (실제 작업 시 수정 가능합니다.)',
    en: 'Set the visibility, tags, and launch languages applied to new jobs. (You can change these per job.)',
  },
  'settings.appLocale': { ko: '앱 언어', en: 'App locale' },
  'settings.themeMode': { ko: '화면 테마', en: 'Theme' },
  'settings.themeMode.system': { ko: '시스템 설정 사용', en: 'Use system setting' },
  'settings.themeMode.light': { ko: '라이트 모드', en: 'Light mode' },
  'settings.themeMode.dark': { ko: '다크 모드', en: 'Dark mode' },
  'settings.metadataLanguage': {
    ko: '제목·설명 작성 기본 언어',
    en: 'Default metadata source language',
  },
  'settings.recommendedLanguageSet': {
    ko: '추천 대상 언어 묶음',
    en: 'Recommended language set',
  },
  'settings.launchLanguageSelection': {
    ko: '출시 언어 선택',
    en: 'Launch languages',
  },
  'settings.launchLanguageSelection.edit': {
    ko: '변경',
    en: 'Edit',
  },
  'settings.launchLanguageSelection.selectedCount': {
    ko: '{count}개 언어 선택됨',
    en: '{count} languages selected',
  },
  'settings.launchLanguages.modalTitle': {
    ko: '출시 언어 선택',
    en: 'Select launch languages',
  },
  'settings.launchLanguages.presets': {
    ko: '빠른 선택',
    en: 'Quick presets',
  },
  'settings.launchLanguages.allLanguages': {
    ko: '언어 직접 선택',
    en: 'Choose languages',
  },
  'settings.launchLanguages.applySelection': {
    ko: '선택 적용',
    en: 'Apply selection',
  },
  'settings.preferences.unsavedChanges': {
    ko: '저장하지 않은 설정 변경사항이 있습니다.',
    en: 'You have unsaved settings changes.',
  },
  'settings.preferences.saveChanges': {
    ko: '변경사항 저장',
    en: 'Save changes',
  },
  'settings.preferences.saved': {
    ko: '설정을 저장했습니다.',
    en: 'Settings saved.',
  },
  'settings.preferences.saveFailed': {
    ko: '설정 저장 실패',
    en: 'Could not save settings',
  },
  'settings.dangerZone.title': {
    ko: '회원탈퇴',
    en: 'Account withdrawal',
  },
  'settings.accountDeletion.button': {
    ko: '회원탈퇴',
    en: 'Delete account',
  },
  'settings.accountDeletion.modalTitle': {
    ko: '회원 탈퇴 안내',
    en: 'Account withdrawal notice',
  },
  'settings.accountDeletion.modalDescription': {
    ko: '즉시 로그아웃되고 계정, YouTube 연결, 업로드 큐, 더빙 작업 기록이 모두 삭제됩니다. 1주일 내 다시 로그인하면 복구할 수 있습니다.',
    en: 'You will be signed out immediately, and your account, YouTube connection, upload queue, and dubbing job history will be deleted. Sign in again within 7 days to restore them.',
  },
  'settings.accountDeletion.confirmLabel': {
    ko: '계속하려면 {confirmation}를 입력하세요',
    en: 'Type {confirmation} to continue',
  },
  'settings.accountDeletion.confirmButton': {
    ko: '회원탈퇴',
    en: 'Withdraw account',
  },
  'settings.accountDeletion.failed': {
    ko: '계정을 삭제하지 못했습니다',
    en: 'Could not delete account',
  },
  'settings.accountDeletion.failedMessage': {
    ko: '잠시 후 다시 시도해 주세요.',
    en: 'Please try again shortly.',
  },
  'features.landing.heroUrlInput.signInRequired': {
    ko: '로그인이 필요합니다',
    en: 'Sign-in required',
  },
  'features.landing.heroUrlInput.signInWithGoogleToContinue': {
    ko: 'Google로 로그인하면 입력한 영상으로 더빙을 이어서 시작합니다.',
    en: 'Sign in with Google to continue dubbing with the video you entered.',
  },
  'components.layout.sidebar.labelSettings': { ko: '설정', en: 'Settings' },
  'components.layout.sidebar.appNavigation': { ko: '앱 메뉴', en: 'App navigation' },
  'components.layout.topbar.subscriberCount': { ko: '구독자 {count}', en: '{count} subscribers' },
  'components.ui.modal.close': { ko: '닫기', en: 'Close' },
  'internal.keyword.popup': { ko: '팝업' },
  'internal.keyword.youtubeConnection': { ko: 'YouTube 연결' },
  'metadata.landing.title': {
    ko: 'YouTube 자막·더빙 AI 도구',
    en: 'AI Captions and Dubbing for YouTube Creators',
  },
  'metadata.landing.description': {
    ko: 'YouTube 크리에이터를 위한 {SUPPORTED_LANGUAGE_COUNT}개 언어 자막 번역, AI 더빙, 업로드 준비 도구.',
    en: 'Caption translation, AI dubbing, and upload prep for YouTube creators in {SUPPORTED_LANGUAGE_COUNT} languages.',
  },
  'marketPreset.core.label': { ko: '기본 출시', en: 'Core launch' },
  'marketPreset.core.description': {
    ko: '국내 사용자를 우선으로 하되 영어권 시청자까지 바로 대응합니다.',
    en: 'Start with Korea-first operations while covering English-speaking viewers.',
  },
  'marketPreset.custom.label': { ko: '내 설정', en: 'My settings' },
  'marketPreset.custom.description': {
    ko: '직접 선택한 출시 대상 언어를 사용합니다.',
    en: 'Use your selected launch languages.',
  },
  'marketPreset.creatorGrowth.label': { ko: '크리에이터 추천 언어', en: 'Creator language picks' },
  'marketPreset.creatorGrowth.description': {
    ko: 'YouTube 시청자가 많고 현지화 효과를 기대하기 쉬운 언어를 우선 선택합니다.',
    en: 'Prioritize languages with large YouTube audiences and practical localization potential.',
  },
  'marketPreset.globalBroad.label': { ko: '다국어 확장', en: 'Multilingual expansion' },
  'marketPreset.globalBroad.description': {
    ko: '초기 성과가 확인된 뒤 유럽과 중동 주요 언어까지 확장합니다.',
    en: 'Expand into major European and Middle Eastern languages after initial traction.',
  },
  'ops.category.uploadQueue': { ko: '업로드 큐', en: 'Upload queue' },
  'ops.category.perso': { ko: '더빙 처리', en: 'Dubbing' },
  'ops.category.credit': { ko: '시간 환급', en: 'Minute release' },
  'ops.category.toss': { ko: '결제', en: 'Payment' },
  'ops.severity.info': { ko: '정보', en: 'Info' },
  'ops.severity.warning': { ko: '주의', en: 'Warning' },
  'ops.severity.error': { ko: '오류', en: 'Error' },
  'ops.severity.critical': { ko: '긴급', en: 'Critical' },
  'ops.event.persoLanguageProcessingFailed': { ko: '언어별 더빙 처리 실패', en: 'Language dubbing failed' },
  'ops.event.dubbingJobFailed': { ko: '더빙 작업 실패', en: 'Dubbing job failed' },
  'ops.event.tossWebhookBodyValidationFailed': { ko: '결제 알림 데이터 확인 실패', en: 'Payment webhook validation failed' },
  'ops.event.tossWebhookPaymentVerificationFailed': { ko: '결제 승인 확인 실패', en: 'Payment verification failed' },
  'ops.event.tossWebhookProcessingFailed': { ko: '결제 알림 처리 실패', en: 'Payment webhook processing failed' },
  'ops.event.reservedCreditsWereReleased': { ko: '예약된 더빙 시간 반환', en: 'Reserved minutes released' },
  'ops.event.unusedReservedCreditsWereReleasedAfterFinalization': { ko: '남은 예약 더빙 시간 반환', en: 'Unused reserved minutes released' },
  'ops.event.youTubeUploadQueueItemFailed': { ko: 'YouTube 업로드 작업 실패', en: 'YouTube upload job failed' },
  'ops.metric.uploadQueueDetail': {
    ko: '{total}건 중 {failed}건 실패, 최종 실패 {terminalFailed}건',
    en: '{failed}/{total} failed, {terminalFailed} terminal',
  },
  'ops.metric.persoDetail': {
    ko: '{total}개 언어 작업 중 {failed}건 실패, {canceled}건 취소',
    en: '{failed} failed, {canceled} canceled / {total} language jobs',
  },
  'ops.metric.creditRefundDetail': { ko: '{releasedMinutes}분 환급', en: '{releasedMinutes} minutes released' },
  'ops.metric.tossDetail': { ko: '영향받은 주문 {affectedOrders}건', en: '{affectedOrders} affected orders' },
  'extension.step.navigating': { ko: 'YouTube Studio 여는 중', en: 'Opening YouTube Studio' },
  'extension.step.openingLanguages': { ko: '번역 페이지 확인 중', en: 'Checking the translations page' },
  'extension.step.selectingLanguage': { ko: '언어 선택 중', en: 'Choosing language' },
  'extension.step.injectingAudio': { ko: '오디오 파일 추가 중', en: 'Adding audio file' },
  'extension.step.waitingPublish': { ko: '게시 대기 중', en: 'Waiting to publish' },
  'extension.step.publishing': { ko: '게시 중', en: 'Publishing' },
  'extension.step.completed': { ko: '완료', en: 'Complete' },
  'dubbing.processing.status.idle': { ko: '대기 중', en: 'Waiting' },
  'dubbing.processing.status.transcribing': { ko: '전사 중', en: 'Transcribing' },
  'dubbing.processing.status.translating': { ko: '번역 중', en: 'Translating' },
  'dubbing.processing.status.synthesizing': { ko: '음성 생성 중', en: 'Generating voice' },
  'dubbing.processing.status.lipSyncing': { ko: '립싱크 중', en: 'Lip-syncing' },
  'dubbing.processing.status.merging': { ko: '처리 중', en: 'Processing' },
  'dubbing.processing.status.completed': { ko: '완료', en: 'Complete' },
  'dubbing.processing.status.failed': { ko: '실패', en: 'Failed' },
  'dubbing.processing.reason.pending': { ko: '작업 순서를 기다리는 중...', en: 'Waiting in queue...' },
  'dubbing.processing.reason.created': { ko: '작업을 준비하는 중...', en: 'Preparing job...' },
  'dubbing.processing.reason.ready': { ko: '전사를 준비하는 중...', en: 'Preparing transcription...' },
  'dubbing.processing.reason.readyTargetLanguages': { ko: '번역하는 중...', en: 'Translating...' },
  'dubbing.processing.reason.enqueued': { ko: '음성 생성을 준비하는 중...', en: 'Preparing voice generation...' },
  'dubbing.processing.reason.processing': { ko: '더빙 오디오를 만드는 중...', en: 'Creating dubbed audio...' },
  'dubbing.processing.reason.completed': { ko: '완료', en: 'Complete' },
  'dubbing.processing.reason.failed': { ko: '처리 실패', en: 'Processing failed' },
  'dubbing.processing.reason.canceled': { ko: '취소됨', en: 'Canceled' },
  'features.landing.pricingSection.includedLanguageCount': {
    ko: '{SUPPORTED_LANGUAGE_COUNT}개 언어 지원',
    en: '{SUPPORTED_LANGUAGE_COUNT} supported languages',
  },
  'features.landing.pricingSection.included1080pOutput': { ko: '1080p 출력', en: '1080p output' },
  'features.landing.pricingSection.includedNoWatermark': { ko: '워터마크 없음', en: 'No watermark' },
  'features.landing.pricingSection.includedYouTubeUploadSupport': { ko: 'YouTube 업로드 지원', en: 'YouTube upload support' },
  'features.landing.pricingSection.includedPurchasedMinutesDoNotExpire': {
    ko: '충전한 더빙 시간 만료 없음',
    en: 'Purchased minutes do not expire',
  },
  'billing.creditPack.oneHour': { ko: '1시간', en: '1 hour' },
  'billing.creditPack.twoHours': { ko: '2시간', en: '2 hours' },
  'app.app.billing.page.checkoutCreationFailed': {
    ko: '결제창 생성에 실패했습니다.',
    en: 'Could not create the checkout.',
  },
  'app.app.billing.fail.page.paymentNotCompleted': {
    ko: '결제가 완료되지 않았습니다',
    en: 'Payment was not completed',
  },
  'app.app.billing.fail.page.paymentCanceledOrFailed': {
    ko: '결제가 취소되었거나 처리 중 문제가 발생했습니다. 다시 시도해 주세요.',
    en: 'The payment was canceled or could not be processed. Please try again.',
  },
  'app.app.billing.fail.page.supportErrorCode': {
    ko: '문의 시 전달할 오류 코드: {code}',
    en: 'Support error code: {code}',
  },
  'app.app.billing.fail.page.tryAgain': { ko: '다시 시도하기', en: 'Try again' },
  'app.app.billing.success.billingSuccessClient.paymentConfirmationFailedFallback': {
    ko: '결제 승인에 실패했습니다.',
    en: 'Payment confirmation failed.',
  },
  'app.app.loading.label': { ko: '로딩 중...', en: 'Loading...' },
  'app.auth.callback.page.connectYouTubeChannel': {
    ko: 'YouTube 채널을 연결해 주세요',
    en: 'Connect your YouTube channel',
  },
  'app.auth.callback.page.connectYouTubeChannelInSettings': {
    ko: '더빙과 업로드를 시작하려면 설정에서 YouTube 채널을 먼저 연결해야 합니다.',
    en: 'Connect your YouTube channel in Settings before starting dubbing and uploads.',
  },
  'app.auth.callback.page.couldNotSignIn': {
    ko: '로그인할 수 없습니다',
    en: 'Could not sign in',
  },
  'app.auth.callback.page.processingLogin': { ko: '로그인 처리 중입니다...', en: 'Signing you in...' },
  'app.auth.callback.page.tryAgainShortly': {
    ko: '잠시 후 다시 시도해 주세요. 문제가 계속되면 문의해 주세요.',
    en: 'Please try again shortly. Contact us if the problem continues.',
  },
  'app.app.uploads.page.couldNotLoadVideosToUpload': {
    ko: '업로드할 영상을 불러오지 못했습니다.',
    en: 'Could not load videos to upload.',
  },
  'features.dubbing.components.steps.translationEditStep.channelWithSubscriberCount': {
    ko: '{title} · 구독자 {count}',
    en: '{title} · {count} subscribers',
  },
  'features.dubbing.components.steps.translationEditStep.metadataBasedOn': {
    ko: '{language} 기준',
    en: 'Based on {language}',
  },
  'features.dubbing.components.steps.uploadSettingsStep.defaultDescription': {
    ko: '{title} - sub2tube AI 더빙',
    en: '{title} - sub2tube AI dubbing',
  },
  'features.dubbing.components.steps.uploadStep.completedLanguageProgress': {
    ko: '{completed} / {total}개 언어 완료. ',
    en: '{completed} of {total} languages complete. ',
  },
  'features.dubbing.components.steps.videoInputStep.durationLabel': {
    ko: '길이 {duration}',
    en: '{duration} long',
  },
  'features.dubbing.components.steps.uploadStep.editCaptionsOnly': {
    ko: '자막 편집',
    en: 'Edit captions',
  },
  'features.dubbing.components.steps.uploadStep.captionOnlyEditsApplyToCaptionFiles': {
    ko: '이 모드에서는 자막 텍스트와 시간만 편집합니다. 대사 수정과 오디오 재생성은 숨겨집니다.',
    en: 'In this mode, edit only caption text and timing. Dialogue editing and audio regeneration are hidden.',
  },
  'features.dubbing.components.subtitleScriptEditor.valueCaptionsOnly': {
    ko: '{languageName} 자막',
    en: '{languageName} captions',
  },
  'features.dubbing.components.subtitleScriptEditor.dialogueTab': {
    ko: '대사',
    en: 'Dialogue',
  },
  'features.dubbing.components.subtitleScriptEditor.captionsTab': {
    ko: '자막',
    en: 'Captions',
  },
  'features.dubbing.components.subtitleScriptEditor.dialogueChanged': {
    ko: '변경됨',
    en: 'Changed',
  },
  'features.dubbing.components.subtitleScriptEditor.editDialogueThenApplyToRegenerateLanguageAudio': {
    ko: '대사를 수정한 뒤 적용하면 이 언어의 오디오를 다시 생성합니다.',
    en: 'Edit dialogue, then apply changes to regenerate audio for this language.',
  },
  'features.dubbing.components.subtitleScriptEditor.dialogueChangesValue': {
    ko: '대사 변경 {count}개',
    en: '{count} dialogue changes',
  },
  'features.dubbing.components.subtitleScriptEditor.noDialogueChanges': {
    ko: '대사 변경 없음',
    en: 'No dialogue changes',
  },
  'features.dubbing.components.subtitleScriptEditor.applyRegeneratesThisLanguageAudio': {
    ko: '적용하면 저장한 뒤 이 언어의 오디오 재생성을 시작합니다.',
    en: 'Applying saves the edits and starts audio regeneration for this language.',
  },
  'features.dubbing.components.subtitleScriptEditor.discardChanges': {
    ko: '변경 취소',
    en: 'Discard changes',
  },
  'features.dubbing.components.subtitleScriptEditor.applyDialogueChanges': {
    ko: '적용하기',
    en: 'Apply changes',
  },
  'features.dubbing.components.subtitleScriptEditor.dialogueChangesApplied': {
    ko: '대사 변경 적용됨',
    en: 'Dialogue changes applied',
  },
  'features.dubbing.components.subtitleScriptEditor.dialogueChangesAppliedMessage': {
    ko: '{languageName} 대사를 저장하고 오디오 재생성을 시작했습니다.',
    en: 'Saved {languageName} dialogue and started audio regeneration.',
  },
  'features.dubbing.components.subtitleScriptEditor.dialogueChangesApplyFailed': {
    ko: '대사 변경을 적용하지 못했습니다',
    en: 'Could not apply dialogue changes',
  },
  'features.dubbing.components.subtitleScriptEditor.captionChangesPending': {
    ko: '자막 변경 있음',
    en: 'Caption changes pending',
  },
  'features.dubbing.components.subtitleScriptEditor.timeFormatInvalid': {
    ko: '시간 형식을 확인해 주세요. 예: 00:01:23,456',
    en: 'Check the time format. Example: 00:01:23,456',
  },
  'features.dubbing.components.subtitleScriptEditor.timeRangeInvalid': {
    ko: '시작 시간은 종료 시간보다 빨라야 합니다.',
    en: 'Start time must be before end time.',
  },
  'features.dubbing.components.subtitleScriptEditor.fixCaptionTimingBeforeExport': {
    ko: '자막 시간을 먼저 확인해 주세요.',
    en: 'Fix caption timing before exporting.',
  },
  'features.dubbing.components.steps.languageSelectStep.videoLengthRounded': {
    ko: '올린 영상 길이',
    en: 'Uploaded video length',
  },
  'features.dubbing.components.steps.languageSelectStep.selectedLanguageCount': {
    ko: '선택한 언어 갯수',
    en: 'Selected language count',
  },
  'features.dubbing.components.steps.languageSelectStep.estimatedUsage': {
    ko: '예상 차감 분',
    en: 'Estimated minutes used',
  },
  'features.dubbing.components.steps.languageSelectStep.remainingDubbingTime': {
    ko: '남은 더빙 시간',
    en: 'Remaining dubbing time',
  },
  'features.dubbing.components.steps.languageSelectStep.remainingAfterThisJob': {
    ko: '작업 후 예상 잔여',
    en: 'Estimated remaining after this job',
  },
  'features.dubbing.components.steps.languageSelectStep.notEnoughDubbingTime': {
    ko: '남은 더빙 시간이 부족합니다. 결제 페이지에서 시간을 충전해 주세요.',
    en: 'Not enough dubbing time remains. Add more minutes on the billing page.',
  },
} as const satisfies Record<string, LocalizedText>

const messages = {
  ...baseMessages,
  ...generatedMessages,
} as const satisfies Record<string, LocalizedText>

export type MessageKey = keyof typeof messages
export type MessageParams = Record<string, string | number | boolean | null | undefined>

export function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template
  return template.replace(/\{([A-Za-z_$][\w$]*)\}/g, (match, key) => {
    const value = params[key]
    return value === null || value === undefined ? match : String(value)
  })
}

export function message(locale: AppLocale, key: MessageKey, params?: MessageParams): string {
  return interpolate(text(locale, messages[key]), params)
}
