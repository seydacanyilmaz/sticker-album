// Layout.jsx
// Wraps all protected pages with the Nav bar.
// Instead of adding <Nav /> to every page individually, we wrap
// each protected route with <Layout> in App.jsx.

import Nav from './Nav'

export default function Layout({ children }) {
  return (
    <div>
      <Nav />
      <main>
        {children}
      </main>
    </div>
  )
}