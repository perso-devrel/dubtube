'use client'

import { type ReactNode, createContext, useContext, useState } from 'react'
import { cn } from '@/utils/cn'

interface TabsContextValue {
  active: string
  setActive: (v: string) => void
}

const TabsContext = createContext<TabsContextValue>({ active: '', setActive: () => {} })

interface TabsProps {
  defaultValue: string
  children: ReactNode
  className?: string
  onChange?: (value: string) => void
}

export function Tabs({ defaultValue, children, className, onChange }: TabsProps) {
  const [active, setActiveState] = useState(defaultValue)
  const setActive = (v: string) => {
    setActiveState(v)
    onChange?.(v)
  }

  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="tablist" className={cn('flex gap-1 rounded-lg bg-paper-100 p-1 dark:bg-paper-800', className)}>
      {children}
    </div>
  )
}

export function TabsTrigger({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const { active, setActive } = useContext(TabsContext)
  const isActive = active === value

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActive(value)}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm font-medium transition-all cursor-pointer focus-ring',
        isActive
          ? 'bg-ink-900 text-paper-50 shadow-sm dark:bg-paper-50 dark:text-ink-900'
          : 'text-ink-500 hover:text-ink-900 dark:text-ink-200 dark:hover:text-ink-50',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const { active } = useContext(TabsContext)
  if (active !== value) return null
  return <div role="tabpanel" className={cn('animate-fade-in', className)}>{children}</div>
}
