import { NextResponse } from 'next/server'
import { isSupabaseAuthConfigured } from '@/utils/appAuth'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // If there is a "next" parameter, redirect there (e.g., /dashboard)
  const next = searchParams.get('next') ?? '/'

  if (code) {
    if (!isSupabaseAuthConfigured()) {
      return NextResponse.redirect(`${origin}/sign-in?error=Supabase%20OAuth%20is%20disabled`)
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development'
      
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // If something broke, send them to an error page
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
