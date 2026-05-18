/**
 * YouTube Data API v3 types — NOT server-only (used by both sides).
 */

export interface YouTubeUploadResult {
  videoId: string
  title: string
  status: string
  postProcessing?: YouTubePostUploadResult
}

export interface YouTubePostUploadWarning {
  action: 'thumbnail' | 'playlist'
  message: string
}

export interface YouTubePostUploadResult {
  thumbnailUploaded: boolean
  playlistItemIds: string[]
  warnings: YouTubePostUploadWarning[]
}

export interface YouTubeLocalization {
  title: string
  description: string
}

export interface YouTubeVideoMetadata {
  videoId: string
  title: string
  description: string
  categoryId: string
  tags: string[]
  defaultLanguage: string
  resolvedLanguage: string
  resolvedFrom: 'default' | 'localization'
  localizations: Record<string, YouTubeLocalization>
}

export interface VideoStats {
  videoId: string
  viewCount: number
  likeCount: number
  commentCount: number
}

export interface ChannelStats {
  subscriberCount: number
  viewCount: number
  videoCount: number
  channelId: string
  title: string
  thumbnail: string
}

export interface MyVideoItem {
  videoId: string
  title: string
  description: string
  thumbnail: string
  publishedAt: string
  privacyStatus: 'public' | 'unlisted' | 'private' | 'unknown'
}

export interface AnalyticsDailyRow {
  date: string
  views: number
  estimatedMinutesWatched: number
  averageViewDuration: number
}

export interface AnalyticsCountryRow {
  country: string
  views: number
  estimatedMinutesWatched: number
}

export interface VideoAnalytics {
  videoId: string
  daily: AnalyticsDailyRow[]
  countries: AnalyticsCountryRow[]
  totals: {
    views: number
    estimatedMinutesWatched: number
    averageViewDuration: number
  }
}
