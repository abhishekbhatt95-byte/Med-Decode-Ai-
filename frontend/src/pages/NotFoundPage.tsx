import React from 'react'

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] py-12 px-4 text-center">
      <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
      <h2 className="text-3xl font-bold text-foreground mb-4">Page Not Found</h2>
      <p className="text-muted-foreground text-lg max-w-md mb-8">
        We couldn't find the page you were looking for. It might have been moved or deleted.
      </p>
      <button className="bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-lg hover:opacity-90 cursor-pointer">
        Go Back Home
      </button>
    </div>
  )
}
