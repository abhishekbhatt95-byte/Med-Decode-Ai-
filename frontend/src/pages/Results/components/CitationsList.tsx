import React from 'react'

export interface Citation {
  id: string
  title: string
  url: string
}

export interface CitationsListProps {
  citations: Citation[]
}

export const CitationsList: React.FC<CitationsListProps> = ({ citations }) => {
  if (!citations || citations.length === 0) return null

  return (
    <div className="pt-6 w-full text-left print:hidden">
      <span className="text-xs font-bold text-slate-400 block mb-3">
        Verified Medical Database References:
      </span>
      <div className="flex flex-wrap gap-2.5">
        {citations.map((c) => (
          <a
            key={c.id}
            href={c.url}
            target="_blank"
            rel="noreferrer"
            className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 font-extrabold px-4 py-2 rounded-full text-[10px] inline-flex items-center gap-1.5 transition-all"
          >
            📖 {c.title}
          </a>
        ))}
      </div>
    </div>
  )
}
