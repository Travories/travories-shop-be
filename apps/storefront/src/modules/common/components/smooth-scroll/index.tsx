"use client"

import { useEffect } from "react"
import Lenis from "lenis"
import "lenis/dist/lenis.css"

/**
 * Site-wide smooth scrolling, mounted once in the root layout.
 *
 * Does nothing when the OS asks for reduced motion: globals.css already
 * flattens animations for those users, and hijacking the scroll would quietly
 * override that guarantee.
 *
 * Lenis drives the real window scroll (no wrapper element), so `position:
 * sticky` on the nav and Headless UI overlays keep working. Any inner scroll
 * area that should keep native scrolling can opt out with `data-lenis-prevent`.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return
    }

    const lenis = new Lenis()

    let raf = 0
    const loop = (time: number) => {
      lenis.raf(time)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
    }
  }, [])

  return null
}
