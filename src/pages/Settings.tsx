import { useEffect, useState } from 'react'
import { Save, User, Bell, Shield, Palette } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function getSetting(key: string, fallback: string) {
  try {
    return localStorage.getItem('devboard-setting-' + key) ?? fallback
  } catch {
    return fallback
  }
}

function Settings() {
  const { user } = useAuth()

  const [workspace, setWorkspace] = useState('DevBoard Workspace')
  const [description, setDescription] = useState('Our team workspace for building great products.')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [notifications, setNotifications] = useState(true)
  const [updates, setUpdates] = useState(true)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

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
          workspace_name: getSetting('workspace', 'DevBoard Workspace'),
          description: getSetting('description', 'Our team workspace for building great products.'),
          full_name: getSetting(
            'name',
            String(currentUser.user_metadata?.full_name || 'Alex Morgan')
          ),
          notifications: getSetting('notifications', 'true') === 'true',
          updates: getSetting('updates', 'true') === 'true'
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

    loadSettings()

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

    setSaving(false)

    if (saveError) {
      setError(saveError.message)
      return
    }

    setSaved(true)
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
        <label>Workspace name</label>
        <input value={workspace} onChange={event => setWorkspace(event.target.value)} />
        <label>Description</label>
        <textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} />
      </section>

      <section className="workspace-panel settings-section">
        <div className="settings-section-heading">
          <User size={19} />
          <div><strong>Profile</strong><span>Update your personal information.</span></div>
        </div>
        <label>Full name</label>
        <input value={name} onChange={event => setName(event.target.value)} />
        <label>Email address</label>
        <input type="email" value={email} readOnly />
        <small className="settings-note">Your email is managed by your sign-in account.</small>
      </section>

      <section className="workspace-panel settings-section">
        <div className="settings-section-heading">
          <Bell size={19} />
          <div><strong>Notifications</strong><span>Choose which updates you receive.</span></div>
        </div>
        <label className="settings-toggle">
          <span><strong>Task notifications</strong><small>Receive updates about task activity.</small></span>
          <input type="checkbox" checked={notifications} onChange={event => setNotifications(event.target.checked)} />
        </label>
        <label className="settings-toggle">
          <span><strong>Product updates</strong><small>Receive news about new features.</small></span>
          <input type="checkbox" checked={updates} onChange={event => setUpdates(event.target.checked)} />
        </label>
      </section>

      <section className="workspace-panel settings-section">
        <div className="settings-section-heading">
          <Shield size={19} />
          <div><strong>Security</strong><span>Your account security preferences.</span></div>
        </div>
        <p className="settings-note">Your sign-in and account security are managed by Supabase authentication.</p>
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
