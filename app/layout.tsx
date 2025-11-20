import type React from "react"
import type { Metadata } from "next"
import { Comic_Relief, Rubik_Marker_Hatch } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/components/auth-provider"
import { Toaster } from "sonner"
import "./globals.css"

const comicRelief = Comic_Relief({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-sans",
})
const rubikMarkerHatch = Rubik_Marker_Hatch({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-rubik-marker-hatch",
})

export const metadata: Metadata = {
  title: "MPS Media Poetry Challenge - Voting Platform",
  description: "Vote for your favorite poets in the MPS Media Poetry Challenge",
  generator: "v0.app",
  openGraph: {
    title: "MPS Poetry Challenge - Voting Platform",
    description: "Professional voting platform for MPS Media Poetry Challenge",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased ${comicRelief.variable} ${rubikMarkerHatch.variable}`}>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Analytics />
        <Toaster />
      </body>
    </html>
  )
}
