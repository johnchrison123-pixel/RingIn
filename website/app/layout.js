import './globals.css'

const SITE_URL = 'https://ring-in.vercel.app'
const SITE_NAME = 'RingIn'
const SITE_TAGLINE = 'Talk to Experts Instantly'
const SITE_DESCRIPTION = 'Connect with verified domain experts — doctors, lawyers, coaches, engineers, and more. Pay per minute via secure call. Earn coins by helping others. Built in India.'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s`,  // Pages set their own full titles
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'expert calling app', 'online doctor consultation', 'career coach',
    'financial advisor india', 'mentorship app', 'pay per minute',
    'live workshops', 'kerala', 'kochi', 'india', 'consultation app',
    'expert advice', 'one on one mentor',
  ],
  authors: [{ name: 'RingIn Team' }],
  creator: 'RingIn',
  publisher: 'RingIn',
  formatDetection: { email: false, address: false, telephone: false },
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: 'en_IN',
    type: 'website',
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    creator: '@ringin_app',
    images: [`${SITE_URL}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  verification: {
    // Add when you get them: google: 'verification-code'
  },
}

export const viewport = {
  themeColor: '#09090E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({ children }) {
  // Site-wide JSON-LD
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description: SITE_DESCRIPTION,
    sameAs: [
      'https://twitter.com/ringin_app',
      'https://www.instagram.com/ringin_app',
      'https://www.linkedin.com/company/ringin',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@ringin.app',
      contactType: 'Customer Support',
    },
  }

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/experts?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://fnthuegoevgicqmzhwcw.supabase.co" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
