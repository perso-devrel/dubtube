export const DEFAULT_YOUTUBE_CATEGORY_ID = '22'

export const YOUTUBE_VIDEO_CATEGORY_OPTIONS = [
  { value: '1', labelKo: '영화/애니메이션', labelEn: 'Film & Animation' },
  { value: '2', labelKo: '자동차/차량', labelEn: 'Autos & Vehicles' },
  { value: '10', labelKo: '음악', labelEn: 'Music' },
  { value: '15', labelKo: '반려동물/동물', labelEn: 'Pets & Animals' },
  { value: '17', labelKo: '스포츠', labelEn: 'Sports' },
  { value: '19', labelKo: '여행/이벤트', labelEn: 'Travel & Events' },
  { value: '20', labelKo: '게임', labelEn: 'Gaming' },
  { value: '22', labelKo: '인물/블로그', labelEn: 'People & Blogs' },
  { value: '23', labelKo: '코미디', labelEn: 'Comedy' },
  { value: '24', labelKo: '엔터테인먼트', labelEn: 'Entertainment' },
  { value: '25', labelKo: '뉴스/정치', labelEn: 'News & Politics' },
  { value: '26', labelKo: '노하우/스타일', labelEn: 'Howto & Style' },
  { value: '27', labelKo: '교육', labelEn: 'Education' },
  { value: '28', labelKo: '과학/기술', labelEn: 'Science & Technology' },
  { value: '29', labelKo: '비영리/사회운동', labelEn: 'Nonprofits & Activism' },
] as const

export function getYouTubeCategoryOptions(locale?: string) {
  const useKo = locale?.toLowerCase().startsWith('ko')
  return YOUTUBE_VIDEO_CATEGORY_OPTIONS.map((option) => ({
    value: option.value,
    label: useKo ? option.labelKo : option.labelEn,
  }))
}

export function getYouTubeCategoryLabel(categoryId: string, locale?: string) {
  const option = YOUTUBE_VIDEO_CATEGORY_OPTIONS.find((item) => item.value === categoryId)
  if (!option) return categoryId
  return locale?.toLowerCase().startsWith('ko') ? option.labelKo : option.labelEn
}

export function parsePlaylistIds(value: string | string[] | null | undefined): string[] {
  const values = Array.isArray(value) ? value : [value ?? '']
  const ids = values
    .flatMap((entry) => entry.split(/[\s,]+/))
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      try {
        const url = new URL(entry)
        return url.searchParams.get('list') || entry
      } catch {
        return entry
      }
    })
    .map((entry) => entry.trim())
    .filter(Boolean)

  return Array.from(new Set(ids))
}

export function formatPlaylistIds(ids: string[]) {
  return ids.join(', ')
}
