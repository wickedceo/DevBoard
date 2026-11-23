import { useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { AuthContext } from './auth-context'
import { supabase, supabaseConfigured, supabaseConfigError } from '../lib/supabase'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabaseConfigured)
  const [error, setError] = useState<string | null>(
    supabaseConfigured ? null : supabaseConfigError,
  )

  useEffect(() => {
    if (!supabaseConfigured) return

    let active = true
    let authEventReceived = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!active) return
        authEventReceived = true
        setSession(newSession)
        setUser(newSession?.user ?? null)
        setError(null)
        setLoading(false)
      },
    )

    void supabase.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (!active || authEventReceived) return
        if (sessionError) setError(`Could not restore your session: ${sessionError.message}`)
        setSession(data.session)
        setUser(data.session?.user ?? null)
      })
      .catch((sessionError: unknown) => {
        if (!active || authEventReceived) return
        setError(
          `Could not restore your session: ${
            sessionError instanceof Error ? sessionError.message : 'Unknown error'
          }`,
        )
      })
      .finally(() => {
        if (active && !authEventReceived) setLoading(false)
      })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, loading, error }}>
      {children}
    </AuthContext.Provider>
  )
}
