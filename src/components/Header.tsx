import { useState, type FormEvent } from 'react'
import { Search, Bell, Plus, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { supabase } from '../lib/supabase'

function Header() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = search.trim()
    navigate(query ? `/tasks?search=${encodeURIComponent(query)}` : '/tasks')
  }

  async function handleSignOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('Sign out failed:', message)
      window.alert(`Could not sign out: ${message}`)
    }
  }

  return (
    <header className="top-header">
      <form className="header-search" onSubmit={handleSearch}>
        <Search size={18} />
        <input
          type="search"
          aria-label="Search tasks"
          placeholder="Search tasks..."
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      <div className="header-actions">
        <button
          className="icon-button"
          aria-label="Notifications"
          onClick={() => navigate('/notifications')}
        >
          <Bell size={19} />
        </button>

        <button className="create-button" onClick={() => navigate('/projects?create=1')}>
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
