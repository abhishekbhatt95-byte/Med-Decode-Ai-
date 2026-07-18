import React from 'react'

export interface OriginalDocViewerProps {
  show: boolean
  url: string | null
  isPdf: boolean
}

export const OriginalDocViewer: React.FC<OriginalDocViewerProps> = ({ show, url, isPdf }) => {
  if (!show || !url) return null

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
        <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">📄 Original Document</h3>
        <span className="text-xs text-slate-400">Signed link · valid 5 minutes</span>
      </div>
      <div className="p-2">
        {isPdf ? (
          <iframe
            src={url}
            className="w-full h-[600px] border-0"
            title="Original document"
          />
        ) : (
          <img
            src={url}
            alt="Original document"
            className="max-w-full mx-auto rounded-lg"
            loading="lazy"
            decoding="async"
          />
        )}
      </div>
    </div>
  )
}
