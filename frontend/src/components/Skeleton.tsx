import React from 'react'

interface SkeletonProps {
  className?: string
}

/** Base animated shimmer block */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div
    aria-hidden="true"
    className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-xl ${className}`}
  />
)

/** Single line of text */
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 1,
  className = '',
}) => (
  <div className={`space-y-2 ${className}`} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={`h-3.5 rounded-full ${i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'}`}
      />
    ))}
  </div>
)

/** Card-level skeleton */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    aria-hidden="true"
    className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 space-y-4 ${className}`}
  >
    <Skeleton className="h-5 w-1/3 rounded-full" />
    <SkeletonText lines={3} />
    <div className="flex gap-2 pt-1">
      <Skeleton className="h-8 w-20 rounded-full" />
      <Skeleton className="h-8 w-20 rounded-full" />
    </div>
  </div>
)

/** Conversation list item skeleton */
export const SkeletonConversation: React.FC = () => (
  <div
    aria-hidden="true"
    className="p-3 rounded-xl space-y-2 bg-slate-50/50 dark:bg-slate-800/50"
  >
    <div className="flex justify-between items-center gap-2">
      <Skeleton className="h-3 w-2/3 rounded-full" />
      <Skeleton className="h-2.5 w-10 rounded-full" />
    </div>
    <Skeleton className="h-2.5 w-1/2 rounded-full opacity-60" />
  </div>
)

/** Inline message skeleton */
export const SkeletonMessage: React.FC<{ isUser?: boolean }> = ({ isUser = false }) => (
  <div
    aria-hidden="true"
    className={`flex items-start gap-2 max-w-[80%] ${isUser ? 'self-end flex-row-reverse' : 'self-start'}`}
  >
    <Skeleton className="w-8 h-8 rounded-full shrink-0" />
    <div className="space-y-1.5 flex-1">
      <Skeleton className={`h-16 rounded-2xl ${isUser ? 'rounded-tr-none' : 'rounded-tl-none'}`} />
      <Skeleton className="h-2 w-16 rounded-full" />
    </div>
  </div>
)

/** Full page loading skeleton for ResultsPage */
export const SkeletonResults: React.FC = () => (
  <div className="py-8 px-4 max-w-7xl mx-auto space-y-8 animate-pulse" aria-label="Loading results..." aria-busy="true">
    {/* Header */}
    <div className="space-y-3 border-b border-slate-100 dark:border-slate-800 pb-6">
      <Skeleton className="h-10 w-64 rounded-full" />
      <Skeleton className="h-4 w-96 rounded-full" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
    </div>
    {/* Grid */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="space-y-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  </div>
)
