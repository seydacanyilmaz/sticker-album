// Layout.jsx
// Wraps all protected pages with the Nav bar.

import Nav from './Nav'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
