import type React from "react"
import type { Metadata, Viewport } from "next"
import { Quicksand, Rubik_Marker_Hatch } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/components/auth-provider"
import { PWARegister } from "@/components/pwa-register"
import { Toaster } from "sonner"
import "./globals.css"

const quicksand = Quicksand({
  subsets: ["latin"],
  variable: "--font-quicksand",
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
  applicationName: "MPS Poetry",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MPS Poetry",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "MPS Poetry Challenge - Voting Platform",
    description: "Professional voting platform for MPS Media Poetry Challenge",
  },
}

export const viewport: Viewport = {
  themeColor: "#667eea",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased ${quicksand.variable} ${rubikMarkerHatch.variable}`}>
        <AuthProvider>
          {children}
        </AuthProvider>
        <PWARegister />
        <Analytics />
        <Toaster />
      </body>
    </html>
  )
}
