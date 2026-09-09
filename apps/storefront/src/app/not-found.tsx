import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Page not found | Nepal Souvenirs by Travories",
  description: "The page you tried to access does not exist.",
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div className="flex flex-col gap-4 items-center justify-center min-h-[calc(100vh-64px)]">
      <h1 className="text-2xl-semi text-ui-fg-base">Page not found</h1>
      <p className="text-small-regular text-ui-fg-base">
        The page you tried to access does not exist.
      </p>
      <a className="flex gap-x-1 items-center group" href="/">
        <span className="text-ui-fg-interactive">Go to frontpage →</span>
      </a>
    </div>
  )
}
