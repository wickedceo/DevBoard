import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Search, Users, Mail, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type Member = {
  id: number
  name: string
  email: string
  role: string
  status: string
  initials: string
  color: string
}

const initialMembers: Omit<Member, 'id'>[] = [
  { name: 'Alex Morgan', email: 'alex@devboard.com', role: 'Administrator', status: 'Online', initials: 'AM', color: '#8b9ed1' },
  { name: 'Sarah Chen', email: 'sarah@devboard.com', role: 'Designer', status: 'Online', initials: 'SC', color: '#b58bd4' },
  { name: 'James Wilson', email: 'james@devboard.com', role: 'Developer', status: 'Away', initials: 'JW', color: '#6eb9a2' },
  { name: 'Olivia Brown', email: 'olivia@devboard.com', role: 'Project Manager', status: 'Offline', initials: 'OB', color: '#d18b8b' },
]

function Team() {
  const { user } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Developer')

  useEffect(() => {
    if (!user) {
      setMembers([])
      setLoading(false)
      return
    }

    const currentUser = user
    let cancelled = false

    async function loadMembers() {
      setLoading(true)
      setError('')

      const { data, error: fetchError } = await supabase
        .from('team_members')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: true })

      if (cancelled) return

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      if (data && data.length > 0) {
        setMembers(data as Member[])
        setLoading(false)
        return
      }

      let savedMembers: Omit<Member, 'id'>[] = initialMembers

      try {
        const saved = localStorage.getItem('devboard-team')
        if (saved) {
          savedMembers = (JSON.parse(saved) as Member[]).map(
            ({ name, email, role, status, initials, color }) => ({
              name, email, role, status, initials, color,
            })
          )
        }
      } catch {
        savedMembers = initialMembers
      }

      if (savedMembers.length === 0) {
        setMembers([])
        setLoading(false)
        return
      }

      const { data: migrated, error: migrationError } = await supabase
        .from('team_members')
        .insert(
          savedMembers.map(member => ({
            ...member,
            user_id: currentUser.id,
          }))
        )
        .select()

      if (cancelled) return

      if (migrationError) {
        setError(migrationError.message)
      } else {
        setMembers((migrated || []) as Member[])
      }

      setLoading(false)
    }

    loadMembers()

    return () => {
      cancelled = true
    }
  }, [user])

  const filteredMembers = useMemo(() => members.filter(member => {
    const matchesSearch =
      member.name.toLowerCase().includes(search.toLowerCase()) ||
      member.email.toLowerCase().includes(search.toLowerCase())

    return matchesSearch && (filter === 'All' || member.role === filter)
  }), [members, search, filter])

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !name.trim() || !email.trim()) return

    setSaving(true)
    setError('')

    const cleanName = name.trim()

    const { data, error: insertError } = await supabase
      .from('team_members')
      .insert({
        user_id: user.id,
        name: cleanName,
        email: email.trim(),
        role,
        status: 'Offline',
        initials: cleanName.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase(),
        color: '#c6a76a',
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setMembers(current => [...current, data as Member])
    setName('')
    setEmail('')
    setRole('Developer')
    setShowForm(false)
    setSaving(false)
  }

  async function removeMember(id: number) {
    setError('')

    const { error: deleteError } = await supabase
      .from('team_members')
      .delete()
      .eq('id', id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setMembers(current => current.filter(member => member.id !== id))
  }

  return (
    <div className="workspace-page">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">WORKSPACE</span>
          <h1>Team</h1>
          <p>Manage your people, responsibilities and collaboration.</p>
        </div>
        <button className="workspace-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={17} /> Add member
        </button>
      </div>

      <div className="workspace-stats">
        <div className="workspace-stat">
          <span>Total members</span>
          <strong>{members.length}</strong>
        </div>
        <div className="workspace-stat">
          <span>Online</span>
          <strong>{members.filter(member => member.status === 'Online').length}</strong>
        </div>
        <div className="workspace-stat">
          <span>Administrators</span>
          <strong>{members.filter(member => member.role === 'Administrator').length}</strong>
        </div>
      </div>

      {showForm && (
        <form className="workspace-form" onSubmit={addMember}>
          <input value={name} onChange={event => setName(event.target.value)} placeholder="Full name" required />
          <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email address" required />
          <select value={role} onChange={event => setRole(event.target.value)}>
            <option>Developer</option>
            <option>Designer</option>
            <option>Project Manager</option>
            <option>Administrator</option>
          </select>
          <button type="submit" disabled={saving}>
            {saving ? 'Adding...' : 'Add member'}
          </button>
          <button type="button" className="workspace-cancel" onClick={() => setShowForm(false)}>Cancel</button>
        </form>
      )}

      {error && <p role="alert" className="workspace-error">{error}</p>}

      <section className="workspace-panel">
        <div className="workspace-toolbar">
          <div className="workspace-search">
            <Search size={17} />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search team members..." />
          </div>
          <div className="workspace-filters">
            {['All', 'Administrator', 'Designer', 'Developer', 'Project Manager'].map(item => (
              <button key={item} className={filter === item ? 'filter-active' : ''} onClick={() => setFilter(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="workspace-empty">Loading team members...</div>
        ) : (
          <>
            <div className="team-list">
              {filteredMembers.map(member => (
                <article className="team-member-row" key={member.id}>
                  <div className="team-member-avatar" style={{ background: member.color }}>
                    {member.initials}
                  </div>
                  <div className="team-member-info">
                    <strong>{member.name}</strong>
                    <span><Mail size={13} /> {member.email}</span>
                  </div>
                  <span className="team-member-role">{member.role}</span>
                  <span className={`team-member-status ${member.status.toLowerCase()}`}>
                    <i /> {member.status}
                  </span>
                  <button className="task-delete" onClick={() => removeMember(member.id)} aria-label={`Remove ${member.name}`}>
                    <Trash2 size={16} />
                  </button>
                </article>
              ))}
            </div>

            {filteredMembers.length === 0 && (
              <div className="workspace-empty">
                <Users size={28} />
                <strong>No team members found</strong>
                <span>Try another search or role filter.</span>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

export default Team
