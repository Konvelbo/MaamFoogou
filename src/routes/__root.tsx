import { useEffect } from 'react'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { ClerkProvider, useUser } from '@clerk/clerk-react'
import { loginWithClerkUser } from '../services/maamfoogouStore'

import appCss from '../styles.css?url'

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || ''

function ClerkGlobalSync() {
  const { user, isLoaded } = useUser()

  useEffect(() => {
    if (isLoaded && user && user.primaryEmailAddress) {
      loginWithClerkUser({
        clerkUserId: user.id,
        email: user.primaryEmailAddress.emailAddress,
        name: user.fullName || user.firstName || 'Membre Google',
        avatarUrl: user.imageUrl,
      })
    }
  }, [isLoaded, user])

  return null
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'MAAMFOOGOU — Studio 3D & Prêt-à-Porter Personnalisable',
      },
    ],
    links: [
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon.svg',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Caveat:wght@600;700&family=Cinzel:wght@600;700&family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Montserrat:wght@400;500;600;700;800&family=Oswald:wght@500;600;700&family=Permanent+Marker&family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&family=Syne:wght@600;700;800&family=Unbounded:wght@600;700;800&display=swap',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const content = (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body className="bg-white text-[#111111] antialiased selection:bg-[#111111] selection:text-white">
        {children}
        <Scripts />
      </body>
    </html>
  )

  if (CLERK_PUBLISHABLE_KEY) {
    return (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
        <ClerkGlobalSync />
        {content}
      </ClerkProvider>
    )
  }

  return content
}
