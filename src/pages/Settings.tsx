import { useEffect, useState, type FormEvent } from 'react'
import { Save, User, Bell, Shield, Palette } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'

function Settings() {
  const { user } = useAuth()

  const [workspace, setWorkspace] = useState('DevBoard Workspace')
  const [description, setDescription] = useState('Our team workspace for building great products.')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [notifications, setNotifications] = useState(true)
  const [updates, setUpdates] = useState(true)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')

  useEffect(() => {
    if (!user) return

    const currentUser = user
    let active = true

    async function loadSettings() {
      setLoading(true)
      setError('')
      setEmail(currentUser.email ?? '')

      const { data, error: loadError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle()

      if (!active) return

      if (loadError) {
        setError(loadError.message)
        setLoading(false)
        return
      }

      if (data) {
        setWorkspace(data.workspace_name)
        setDescription(data.description)
        setName(data.full_name)
        setNotifications(data.notifications)
        setUpdates(data.updates)
      } else {
        const initialSettings = {
          user_id: currentUser.id,
          workspace_name: 'DevBoard Workspace',
          description: 'Our team workspace for building great products.',
          full_name: String(
            currentUser.user_metadata?.full_name ||
            currentUser.email?.split('@')[0] ||
            'Workspace member'
          ),
          notifications: true,
          updates: true,
        }

        const { data: newSettings, error: insertError } = await supabase
          .from('user_settings')
          .upsert(initialSettings, { onConflict: 'user_id' })
          .select()
          .single()

        if (!active) return

        if (insertError) {
          setError(insertError.message)
        } else if (newSettings) {
          setWorkspace(newSettings.workspace_name)
          setDescription(newSettings.description)
          setName(newSettings.full_name)
          setNotifications(newSettings.notifications)
          setUpdates(newSettings.updates)
        }
      }

      if (active) setLoading(false)
    }

    void loadSettings().catch((loadError: unknown) => {
      if (!active) return
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load settings.'
      )
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [user])

  async function saveSettings() {
    const currentUser = user

    if (!currentUser) {
      setError('Please sign in again to save your settings.')
      return
    }

    setSaving(true)
    setSaved(false)
    setError('')

    try {
      const { error: saveError } = await supabase
        .from('user_settings')
        .upsert({
          user_id: currentUser.id,
          workspace_name: workspace,
          description,
          full_name: name,
          notifications,
          updates,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })

      if (saveError) throw saveError
      setSaved(true)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordMessage('')

    if (newPassword.length < 8) {
      setPasswordMessage('Use at least 8 characters for your new password.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage('The password fields do not match.')
      return
    }

    setPasswordSaving(true)
    try {
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (passwordError) throw passwordError
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage('Password updated.')
    } catch (passwordError) {
      setPasswordMessage(
        passwordError instanceof Error ? passwordError.message : 'Could not update password.'
      )
    } finally {
      setPasswordSaving(false)
    }
  }

  if (loading) {
    return <div className="workspace-page"><p>Loading settings...</p></div>
  }

  return (
    <div className="workspace-page">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">PREFERENCES</span>
          <h1>Settings</h1>
          <p>Manage your workspace, profile and preferences.</p>
        </div>
      </div>

      <section className="workspace-panel settings-section">
        <div className="settings-section-heading">
          <Palette size={19} />
          <div><strong>Workspace</strong><span>Customize your workspace details.</span></div>
        </div>
        <label htmlFor="settings-workspace">Workspace name</label>
        <input id="settings-workspace" value={workspace} onChange={event => setWorkspace(event.target.value)} />
        <label htmlFor="settings-description">Description</label>
        <textarea id="settings-description" value={description} onChange={event => setDescription(event.target.value)} rows={3} />
      </section>

      <section className="workspace-panel settings-section">
        <div className="settings-section-heading">
          <User size={19} />
          <div><strong>Profile</strong><span>Update your personal information.</span></div>
        </div>
        <label htmlFor="settings-name">Full name</label>
        <input id="settings-name" value={name} onChange={event => setName(event.target.value)} />
        <label htmlFor="settings-email">Email address</label>
        <input id="settings-email" type="email" value={email} readOnly />
        <small className="settings-note">Your email is managed by your sign-in account.</small>
      </section>

      <section className="workspace-panel settings-section">
        <div className="settings-section-heading">
          <Bell size={19} />
          <div><strong>Notifications</strong><span>Choose which updates you receive.</span></div>
        </div>
        <label className="settings-toggle">
          <span><strong>In-app notifications</strong><small>Store task and project activity in your DevBoard inbox.</small></span>
          <input type="checkbox" checked={notifications} onChange={event => setNotifications(event.target.checked)} />
        </label>
        <p className="settings-note">Email and push notifications are not configured.</p>
      </section>

      <section className="workspace-panel settings-section">
        <div className="settings-section-heading">
          <Shield size={19} />
          <div><strong>Security</strong><span>Update your account password.</span></div>
        </div>
        <form className="settings-password-form" onSubmit={changePassword}>
          <label htmlFor="settings-new-password">New password</label>
          <input
            id="settings-new-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={newPassword}
            onChange={event => setNewPassword(event.target.value)}
          />
          <label htmlFor="settings-confirm-password">Confirm new password</label>
          <input
            id="settings-confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirmPassword}
            onChange={event => setConfirmPassword(event.target.value)}
          />
          <button className="workspace-primary" type="submit" disabled={passwordSaving}>
            {passwordSaving ? 'Updating...' : 'Update password'}
          </button>
        </form>
        {passwordMessage && <p className="settings-note" role="status">{passwordMessage}</p>}
      </section>

      <button
        className="workspace-primary settings-save"
        onClick={saveSettings}
        disabled={saving}
      >
        <Save size={17} /> {saving ? 'Saving...' : 'Save changes'}
      </button>

      {saved && <span className="settings-saved">Changes saved to your account.</span>}
      {error && <p role="alert" className="settings-note">{error}</p>}
    </div>
  )
}

export default Settings
