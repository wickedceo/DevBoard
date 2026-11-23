import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Search, Users, Mail, Trash2, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'

type Member = {
  id: number
  name: string
  email: string
  role: string
  status: string
  initials: string
  color: string
}

function Team() {
  const { user } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Developer')

  useEffect(() => {
    if (!user) return

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

      setMembers([])
      setLoading(false)
    }

    void loadMembers().catch((loadError: unknown) => {
      if (cancelled) return
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load team members.'
      )
      setLoading(false)
    })

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

  function resetMemberForm() {
    setEditingMemberId(null)
    setName('')
    setEmail('')
    setRole('Developer')
  }

  function toggleMemberForm() {
    if (showForm) {
      setShowForm(false)
      resetMemberForm()
      return
    }

    resetMemberForm()
    setShowForm(true)
  }

  function startEditingMember(member: Member) {
    setEditingMemberId(member.id)
    setName(member.name)
    setEmail(member.email)
    setRole(member.role)
    setError('')
    setShowForm(true)
  }

  async function saveMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !name.trim() || !email.trim()) return

    setSaving(true)
    setError('')

    const cleanName = name.trim()

    if (editingMemberId !== null) {
      const { data, error: updateError } = await supabase
        .from('team_members')
        .update({
          name: cleanName,
          email: email.trim(),
          role,
          initials: cleanName.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase(),
        })
        .eq('id', editingMemberId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (updateError) {
        setError(updateError.message)
        setSaving(false)
        return
      }

      setMembers(current => current.map(member =>
        member.id === editingMemberId ? data as Member : member
      ))
      setShowForm(false)
      resetMemberForm()
      setSaving(false)
      return
    }

    const { data, error: insertError } = await supabase
      .from('team_members')
      .insert({
        user_id: user.id,
        name: cleanName,
        email: email.trim(),
        role,
        status: 'Offline',
        initials: cleanName.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase(),
        color: '#c5a46d',
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setMembers(current => [...current, data as Member])
    setShowForm(false)
    resetMemberForm()
    setSaving(false)
  }

  async function removeMember(id: number) {
    if (!user || saving) return

    setSaving(true)
    setError('')

    const { error: deleteError } = await supabase
      .from('team_members')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      setError(deleteError.message)
      setSaving(false)
      return
    }

    setMembers(current => current.filter(member => member.id !== id))
    if (editingMemberId === id) {
      setShowForm(false)
      resetMemberForm()
    }
    setSaving(false)
  }

  return (
    <div className="workspace-page">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">WORKSPACE</span>
        <h1>Team directory</h1>
        <p>Manage contact records for your workspace.</p>
        </div>
      <button className="workspace-primary" onClick={toggleMemberForm}>
        <Plus size={17} /> {showForm ? 'Cancel' : 'Add contact'}
        </button>
      </div>

      <div className="workspace-stats">
        <div className="workspace-stat">
        <span>Directory records</span>
          <strong>{members.length}</strong>
        </div>
        <div className="workspace-stat">
        <span>Developers</span>
        <strong>{members.filter(member => member.role === 'Developer').length}</strong>
        </div>
        <div className="workspace-stat">
        <span>Designers</span>
        <strong>{members.filter(member => member.role === 'Designer').length}</strong>
        </div>
      </div>

      <p className="workspace-note">
      Directory records only. Adding a contact does not send an invitation or grant DevBoard access.
      </p>

      {showForm && (
        <form className="workspace-form" onSubmit={saveMember}>
          <input aria-label="Full name" value={name} onChange={event => setName(event.target.value)} placeholder="Full name" required />
          <input aria-label="Email address" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email address" required />
          <select aria-label="Team member role" value={role} onChange={event => setRole(event.target.value)}>
            <option>Developer</option>
            <option>Designer</option>
            <option>Project Manager</option>
            <option>Administrator</option>
          </select>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : editingMemberId === null ? 'Add member' : 'Save contact'}
          </button>
          <button
            type="button"
            className="workspace-cancel"
            onClick={() => {
              setShowForm(false)
              resetMemberForm()
            }}
          >
            Cancel
          </button>
        </form>
      )}

      {error && <p role="alert" className="workspace-error">{error}</p>}

      <section className="workspace-panel">
        <div className="workspace-toolbar">
          <div className="workspace-search">
            <Search size={17} />
            <input aria-label="Search team members" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search team members..." />
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
                  <div className="team-member-avatar">
                    {member.initials}
                  </div>
                  <div className="team-member-info">
                    <strong>{member.name}</strong>
                    <span><Mail size={13} /> {member.email}</span>
                  </div>
                  <span className="team-member-role">{member.role}</span>
                  <button
                    className="task-edit"
                    onClick={() => startEditingMember(member)}
                    disabled={saving}
                    aria-label={`Edit ${member.name}`}
                    title="Edit contact"
                  >
                    <Pencil size={16} />
                  </button>
                  <button className="task-delete" onClick={() => removeMember(member.id)} disabled={saving} aria-label={`Remove ${member.name}`}>
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
