import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { supabase, supabaseConfigured, supabaseConfigError } from '../lib/supabase'
import { useAuth } from '../context/useAuth'

function Auth() {
  const navigate = useNavigate()
  const { error: authError } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabaseConfigured) {
      setError(supabaseConfigError)
      return
    }
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        navigate('/')
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error

        if (data.session) {
          navigate('/')
        } else {
          setMessage('Account created. Check your email to confirm your account.')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <ShieldCheck size={23} />
          </div>
          <span>DEVBOARD</span>
        </div>

        <div className="auth-heading">
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h1>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1>
          <p>
            {mode === 'login'
              ? 'Sign in to continue building great things.'
              : 'Get started with your own workspace.'}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => {
              setMode('login')
              setError('')
              setMessage('')
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => {
              setMode('signup')
              setError('')
              setMessage('')
            }}
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="auth-email">Email address</label>
          <input
            id="auth-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={event => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="auth-password">Password</label>
          <div className="auth-password">
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'signup' ? 8 : undefined}
              required
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {(error || authError) && (
            <div className="auth-error" role="alert">{error || authError}</div>
          )}
          {message && <div className="auth-message">{message}</div>}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading || !supabaseConfigured}
          >
            {loading
              ? 'Please wait...'
              : !supabaseConfigured
                ? 'Configuration required'
              : mode === 'login'
                ? 'Sign in to DevBoard'
                : 'Create account'}
          </button>
        </form>

        <p className="auth-footer">
          {supabaseConfigured
            ? 'Secure workspace access · Powered by Supabase'
            : 'Configure Supabase to enable account access.'}
        </p>
      </section>
    </main>
  )
}

export default Auth
