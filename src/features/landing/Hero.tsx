'use client'

import { HeroUrlInput } from './HeroUrlInput'
import { SUPPORTED_LANGUAGE_COUNT } from '@/utils/languages'
import { useLocaleText } from '@/hooks/useLocaleText'

type CaptionTrack = {
  code: string
  region: string
  role: 'source' | 'dub'
  active?: boolean
  line: string
  duration: string
}

const TRACKS: CaptionTrack[] = [
  { code: 'EN', region: 'United States', role: 'source', line: "And that's the camera you actually carry.", duration: '08:42' },
  { code: 'KO', region: '대한민국',     role: 'dub',    active: true, line: '결국 매일 들고 다니게 되는 카메라죠.', duration: '08:48' },
  { code: 'JA', region: '日本',          role: 'dub',    line: '毎日持ち歩くカメラなんですよ。', duration: '08:51' },
  { code: 'ES', region: 'España · LATAM', role: 'dub',   line: 'Es la cámara que llevas todos los días.', duration: '08:46' },
]

const LANGUAGE_CHIPS = ['EN', 'KO', 'JA', 'ES', 'PT-BR', 'ID', 'VI', 'HI', 'AR', 'DE', 'FR']

export function Hero() {
  const t = useLocaleText()

  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-5 pb-24 pt-16 sm:px-8 lg:pb-32 lg:pt-24">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          {/* LEFT — Headline → lead → URL → chips. No category labels. */}
          <div>
            <h1 className="display-tight max-w-[26ch] whitespace-pre-line break-keep text-[44px] font-semibold leading-[1.22] text-ink-900 dark:text-ink-50 sm:text-[56px] lg:text-[60px]">
              {t('features.landing.hero.createMultilingualDubsFromOneVideo')}
            </h1>

            <p className="mt-7 max-w-[50ch] whitespace-pre-line break-keep text-[16px] leading-[1.65] text-ink-500 dark:text-ink-200 sm:text-[17px]">
              {t('features.landing.hero.addAYouTubeLinkOrFileChooseLanguages')}
            </p>

            <HeroUrlInput />

            <div className="mt-10 max-w-xl">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
                {LANGUAGE_CHIPS.map((code) => (
                  <span
                    key={code}
                    className="rounded-[4px] border border-paper-200 bg-paper-50 px-2 py-1 font-mono text-[11px] tracking-wide text-ink-700 dark:border-paper-800 dark:bg-paper-900 dark:text-ink-100"
                  >
                    {code}
                  </span>
                ))}
                <span className="px-1 font-mono text-[11px] text-ink-300 dark:text-ink-300">
                  +{SUPPORTED_LANGUAGE_COUNT - LANGUAGE_CHIPS.length} more
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT — Static 4-track caption panel */}
          <div className="lg:pt-2">
            <CaptionPanel t={t} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="h-px bg-paper-200 dark:bg-paper-800" />
      </div>
    </section>
  )
}

function CaptionPanel({ t }: { t: (key: string) => string }) {
  return (
    <figure className="overflow-hidden rounded-lg border border-paper-200 bg-paper-50 shadow-[0_1px_0_rgba(20,19,15,0.03),0_8px_24px_-12px_rgba(20,19,15,0.12)] dark:border-paper-800 dark:bg-paper-900 dark:shadow-[0_1px_0_rgba(0,0,0,0.3),0_8px_24px_-12px_rgba(0,0,0,0.6)]">
      {/* Header — recording-style label */}
      <div className="flex items-center justify-between gap-3 border-b border-paper-200 px-5 py-3.5 dark:border-paper-800">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-clay-500" aria-hidden />
          <span className="text-[12.5px] font-medium text-ink-900 dark:text-ink-50">
            {t('features.landing.hero.localizationJob')}
          </span>
        </div>
        <span className="font-mono text-[11px] text-ink-300 dark:text-ink-300">
          08:42 · 34 langs
        </span>
      </div>

      {/* Timecode + progress */}
      <div className="border-b border-paper-200 px-5 py-3 dark:border-paper-800">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-mono text-ink-500 dark:text-ink-200">00:42 / 08:42</span>
          <span className="font-mono text-ink-300 dark:text-ink-300">4 of 34 active</span>
        </div>
        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-paper-200 dark:bg-paper-800">
          <div className="h-full w-[58%] rounded-full bg-clay-500 dark:bg-clay-400" />
        </div>
      </div>

      {/* Track list — STATIC, never animated, no overlap */}
      <ul className="divide-y divide-paper-200 dark:divide-paper-800">
        {TRACKS.map((track) => (
          <li
            key={track.code}
            className={`px-5 py-4 transition-colors ${
              track.active
                ? 'bg-clay-50/60 dark:bg-clay-500/10'
                : 'hover:bg-paper-100/60 dark:hover:bg-paper-800/40'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`inline-flex h-6 w-9 shrink-0 items-center justify-center rounded-[3px] border font-mono text-[11px] font-medium tabular-nums ${
                    track.active
                      ? 'border-clay-500 bg-clay-500 text-paper-50 dark:border-clay-400 dark:bg-clay-400 dark:text-paper-950'
                      : 'border-paper-300 bg-paper-50 text-ink-700 dark:border-paper-700 dark:bg-paper-900 dark:text-ink-100'
                  }`}
                >
                  {track.code}
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="text-[12px] font-medium text-ink-900 dark:text-ink-50">
                    {track.region}
                    <span className="ml-2 font-mono text-[10.5px] font-normal uppercase tracking-wider text-ink-300 dark:text-ink-300">
                      {track.role}
                    </span>
                  </span>
                </div>
              </div>
              <Waveform active={!!track.active} role={track.role} />
            </div>

            <p
              className={`mt-2.5 truncate text-[13.5px] leading-[1.45] ${
                track.active
                  ? 'text-ink-900 dark:text-ink-50'
                  : 'text-ink-500 dark:text-ink-200'
              }`}
              title={track.line}
            >
              {track.line}
            </p>
          </li>
        ))}
      </ul>
    </figure>
  )
}

function Waveform({ active, role }: { active: boolean; role: 'source' | 'dub' }) {
  const heights =
    role === 'source'
      ? [55, 70, 45, 80, 60, 85, 50, 65, 75, 40, 55, 70]
      : active
        ? [40, 65, 55, 80, 45, 70, 60, 85, 50, 65, 75, 50]
        : [30, 40, 35, 45, 30, 50, 40, 35, 45, 30, 40, 35]
  return (
    <div className="flex h-5 shrink-0 items-center gap-[2px]" aria-hidden>
      {heights.map((h, i) => (
        <span
          key={i}
          className={
            active
              ? 'inline-block w-[2px] rounded-full bg-clay-500 dark:bg-clay-400'
              : role === 'source'
                ? 'inline-block w-[2px] rounded-full bg-ink-700 dark:bg-ink-50'
                : 'inline-block w-[2px] rounded-full bg-paper-300 dark:bg-paper-700'
          }
          style={{
            height: `${h}%`,
            animation: active ? `waveform 1.8s ease-in-out ${i * 90}ms infinite` : undefined,
            transformOrigin: 'center',
          }}
        />
      ))}
    </div>
  )
}
