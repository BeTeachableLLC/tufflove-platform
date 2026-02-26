'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function signInWithInvite(formData: FormData) {
  const email = formData.get('email') as string
  const supabase = await createClient()

  // Determine the correct URL for the link (Localhost vs Production)
  const siteUrl = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000' 
    : 'https://businessassistant.vercel.app';

  // Send the sign-in link
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  })

  if (error) {
    console.error('Error sending invite:', error)
    // In a real app, you would return this error to the UI
    redirect('/join?error=Could not send invite')
  }

  // If successful, redirect to a success page
  redirect('/join/check-email')
}
