import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PixelSwap - Race to Reconstruct',
  description: 'Race to reconstruct the image by swapping adjacent tiles',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

