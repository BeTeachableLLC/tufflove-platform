'use server'

import { redirect } from 'next/navigation'
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
