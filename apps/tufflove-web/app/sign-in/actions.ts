'use server'

import { redirect } from 'next/navigation'
import {
  createFamilyOpsSession,
  isAppSessionSigningConfigured,
  isFamilyOpsAdminEmail,
  isSupabaseAuthConfigured,
  verifyFamilyOpsAdminPassword,
} from '@/utils/appAuth'
import { createClient } from '@/utils/supabase/server'

function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  return process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : 'https://businessassistant.vercel.app'
}

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')

  if (!email || !password) {
    redirect('/sign-in?error=Email%20and%20password%20are%20required')
  }

  if (isFamilyOpsAdminEmail(email) && verifyFamilyOpsAdminPassword(password)) {
    if (!isAppSessionSigningConfigured()) {
      redirect('/sign-in?error=APP_AUTH_SECRET%20or%20AGENT_ADMIN_TOKEN%20must%20be%20set')
    }
    await createFamilyOpsSession(email)
    redirect('/familyops/approvals')
  }

  if (!isSupabaseAuthConfigured()) {
    redirect('/sign-in?error=Invalid%20credentials%20or%20Supabase%20auth%20is%20disabled')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    const message = error.message || 'Could not sign in'
    redirect(`/sign-in?error=${encodeURIComponent(message)}&email=${encodeURIComponent(email)}`)
  }

  redirect('/dashboard')
}

export async function signUpWithPassword(formData: FormData) {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')

  if (!email || !password) {
    redirect('/sign-in?error=Email%20and%20password%20are%20required')
  }

  if (!isSupabaseAuthConfigured()) {
    redirect('/sign-in?error=Self-service%20sign-up%20is%20disabled%20in%20this%20environment')
  }

  const supabase = await createClient()
  const siteUrl = getSiteUrl()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  })

  if (error) {
    const message = error.message || 'Could not create account'
    redirect(`/sign-in?error=${encodeURIComponent(message)}&email=${encodeURIComponent(email)}`)
  }

  if (data?.session) {
    redirect('/dashboard')
  }

  redirect(`/sign-in/check-email?email=${encodeURIComponent(email)}`)
}
