import {
  JsonLd,
  buildSiteMetadata,
  organizationSchema,
  websiteSchema,
} from "@lib/seo"
import type { Metadata } from "next"
import { Playfair_Display, Poppins } from "next/font/google"
import "styles/globals.css"

// Travories house pairing: Poppins carries body and UI, Playfair is reserved
// for display headings on the souvenir side. Both are exposed as CSS variables
// so tailwind.config.js can reference them via font-sans / font-playfair.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
})

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-playfair",
  display: "swap",
})

export const metadata: Metadata = buildSiteMetadata()

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-mode="light"
      className={`${poppins.variable} ${playfair.variable}`}
    >
      <body>
        {/* Site-wide graph. Page-level schema (Product, CollectionPage,
            BreadcrumbList) is emitted by the route that owns it. */}
        <JsonLd data={[organizationSchema(), websiteSchema()]} id="site" />
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
