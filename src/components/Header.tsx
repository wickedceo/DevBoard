import { Search, Bell, Plus, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

function Header() {
  const { user } = useAuth()

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Sign out failed:', error.message)
  }

  return (
    <header className="top-header">
      <div className="header-search">
        <Search size={18} />
        <span>Search anything...</span>
        <kbd>⌘ K</kbd>
      </div>

      <div className="header-actions">
        <button className="icon-button" aria-label="Notifications">
          <Bell size={19} />
        </button>

        <button className="create-button">
          <Plus size={17} />
          <span>New project</span>
        </button>

        <button
          className="signout-button"
          onClick={handleSignOut}
          title={user?.email ?? 'Sign out'}
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  )
}

export default Header
