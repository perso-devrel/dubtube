'use client'

import { type ReactNode, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/utils/cn'
import { X } from 'lucide-react'
import { useLocaleText } from '@/hooks/useLocaleText'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

const FOCUSABLE = 'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])'

export function Modal({ open, onClose, title, children, className, size = 'md' }: ModalProps) {
  const t = useLocaleText()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { onCloseRef.current(); return }
    if (e.key !== 'Tab') return
    const el = dialogRef.current
    if (!el) return
    const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (focusable.length === 0) { e.preventDefault(); return }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }, [])

  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement as HTMLElement | null
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    const el = dialogRef.current
    if (el) {
      const first = el.querySelector<HTMLElement>(FOCUSABLE)
      if (first) first.focus()
      else el.focus()
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      previousFocusRef.current?.focus()
    }
  }, [open, handleKeyDown])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          'relative z-10 flex max-h-[min(720px,calc(100vh-48px))] w-full flex-col rounded-lg border border-paper-200 bg-paper-50 shadow-[0_24px_80px_-36px_rgb(20_19_15/0.56)] animate-fade-in outline-none dark:border-paper-800 dark:bg-paper-900',
          sizes[size],
          className,
        )}
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-paper-200 px-6 py-4 dark:border-paper-800">
            <h2 className="text-lg font-semibold text-ink-900 dark:text-ink-50">{title}</h2>
            <button onClick={onClose} aria-label={t('components.ui.modal.close')} className="rounded-md p-1 text-ink-500 hover:bg-paper-100 hover:text-ink-900 dark:text-ink-200 dark:hover:bg-paper-800 dark:hover:text-ink-50">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="min-h-0 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  )
}
