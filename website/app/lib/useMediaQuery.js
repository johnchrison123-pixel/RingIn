'use client'

import { useState, useEffect } from 'react'

/**
 * useMediaQuery — returns true when the given CSS media query matches.
 * SSR-safe: starts false on the server, then updates after mount.
 *
 * Example:
 *   const isMobile = useMediaQuery('(max-width: 768px)')
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)

    const update = () => setMatches(mql.matches)
    update()

    // Modern browsers
    if (mql.addEventListener) {
      mql.addEventListener('change', update)
      return () => mql.removeEventListener('change', update)
    }
    // Safari < 14 fallback
    mql.addListener(update)
    return () => mql.removeListener(update)
  }, [query])

  return matches
}

// Convenience breakpoints matching globals.css
export const useIsMobile = () => useMediaQuery('(max-width: 768px)')
export const useIsTablet = () => useMediaQuery('(max-width: 900px)')
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')

export default useMediaQuery
