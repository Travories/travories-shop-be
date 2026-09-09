import type { Metadata } from "next"
import { buildSiteMetadata } from "@lib/seo"
import { Playfair_Display, Poppins } from "next/font/google"
import SmoothScroll from "@modules/common/components/smooth-scroll"


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
        <main>{props.children}</main>
      </body>
    </html>
  )
}
