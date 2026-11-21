import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, FolderKanban, CalendarDays, Pencil, Trash2, Save, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type Project = {
  id: number
  name: string
  category: string
  progress: number
  status: string
  due: string
}

function toDateInputValue(value: string) {
  if (!value || value === 'Not scheduled') return ''

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function Projects() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [taskCounts, setTaskCounts] = useState<
    Record<number, { total: number; completed: number }>
  >({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    category: '',
    progress: 0,
    status: 'Planning',
    due: '',
  })

  useEffect(() => {
    let cancelled = false

    async function loadProjects() {
      if (!user) {
        setProjects([])
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      let rows = data ?? []

      if (rows.length === 0) {
        try {
          const saved = localStorage.getItem('devboard-projects')
          const localProjects = saved ? JSON.parse(saved) as Project[] : []

          if (localProjects.length > 0) {
            const migration = localProjects.map(project => ({
              user_id: user.id,
              name: project.name,
              category: project.category,
              progress: project.progress,
              status: project.status,
              due: project.due,
            }))

            const { data: migrated, error: migrationError } = await supabase
              .from('projects')
              .insert(migration)
              .select()

            if (migrationError) {
              setError(`Could not migrate your existing projects: ${migrationError.message}`)
              setLoading(false)
              return
            }

            rows = migrated ?? []
          }
        } catch {
          setError('Could not read your locally saved projects.')
          setLoading(false)
          return
        }
      }

      const { data: taskData, error: taskFetchError } = await supabase
        .from('tasks')
        .select('project_id, status')
        .eq('user_id', user.id)

      if (cancelled) return

      if (taskFetchError) {
        setError(taskFetchError.message)
        setLoading(false)
        return
      }

      const counts: Record<number, { total: number; completed: number }> = {}

      for (const task of taskData ?? []) {
        if (task.project_id === null) continue

        if (!counts[task.project_id]) {
          counts[task.project_id] = { total: 0, completed: 0 }
        }

        counts[task.project_id].total += 1

        if (task.status === 'Completed') {
          counts[task.project_id].completed += 1
        }
      }

      const updatedRows = rows.map(project => {
        const stats = counts[project.id]
        const progress = stats
          ? Math.round((stats.completed / stats.total) * 100)
          : 0

        return { ...project, progress }
      })

      if (!cancelled) {
        setTaskCounts(counts)
        setProjects(updatedRows)
        setLoading(false)
      }
    }

    loadProjects()

    return () => {
      cancelled = true
    }
  }, [user])

  const filtered = useMemo(() => projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'All' || project.status === filter
    return matchesSearch && matchesFilter
  }), [projects, search, filter])

  async function addProject() {
    if (!newName.trim() || !user || saving) return

    setSaving(true)
    setError('')

    const { data, error: insertError } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: newName.trim(),
        category: 'New project',
        progress: 0,
        status: 'Planning',
        due: 'Not scheduled',
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
    } else if (data) {
      setProjects(current => [data, ...current])
      setNewName('')
      setShowForm(false)

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          title: 'New project created',
          message: `${data.name} has been added to your workspace.`,
          type: 'project',
          link: '/projects',
        })

      if (notificationError) {
        console.error('Project notification failed:', notificationError.message)
      }
    }

    setSaving(false)
  }

  function startEditing(project: Project) {
    setEditingId(project.id)
    setEditForm({
      name: project.name,
      category: project.category,
      progress: project.progress,
      status: project.status,
      due: toDateInputValue(project.due),
    })
    setError('')
  }

  async function saveProject() {
    if (!user || editingId === null || !editForm.name.trim() || saving) return

    setSaving(true)
    setError('')

    const { data, error: updateError } = await supabase
      .from('projects')
      .update({
        name: editForm.name.trim(),
        category: editForm.category.trim() || 'General',
                status: editForm.status,
        due: editForm.due.trim() || 'Not scheduled',
      })
      .eq('id', editingId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      setError(updateError.message)
    } else if (data) {
      setProjects(current => current.map(project =>
        project.id === editingId
          ? { ...data, progress: project.progress }
          : project
      ))
      setEditingId(null)
    }

    setSaving(false)
  }

  async function deleteProject(project: Project) {
    if (!user || saving) return

    const confirmed = window.confirm(
      `Delete "${project.name}"? This action cannot be undone.`
    )

    if (!confirmed) return

    setSaving(true)
    setError('')

    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', project.id)
      .eq('user_id', user.id)

    if (deleteError) {
      setError(deleteError.message)
    } else {
      setProjects(current => current.filter(item => item.id !== project.id))

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          title: 'Project deleted',
          message: `${project.name} was removed from your workspace.`,
          type: 'project',
          link: '/projects',
        })

      if (notificationError) {
        console.error('Project notification failed:', notificationError.message)
      }
    }

    setSaving(false)
  }

  return (
    <div className="workspace-page">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">WORKSPACE</span>
          <h1>Projects</h1>
          <p>Manage your projects and keep every milestone on track.</p>
        </div>
        <button className="workspace-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={17} /> New project
        </button>
      </div>

      {showForm && (
        <div className="workspace-form">
          <input
            value={newName}
            onChange={event => setNewName(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && addProject()}
            placeholder="Enter project name..."
          />
          <button onClick={addProject} disabled={saving}>
            {saving ? 'Saving...' : 'Create project'}
          </button>
          <button className="workspace-cancel" onClick={() => setShowForm(false)}>
            Cancel
          </button>
        </div>
      )}

      {error && <p className="projects-error" role="alert">{error}</p>}

      <div className="workspace-stats">
        <div className="workspace-stat">
          <span>Total projects</span>
          <strong>{projects.length}</strong>
        </div>
        <div className="workspace-stat">
          <span>In progress</span>
          <strong>{projects.filter(p => p.status === 'In progress').length}</strong>
        </div>
        <div className="workspace-stat">
          <span>Completed</span>
          <strong>{projects.filter(p => p.status === 'Completed').length}</strong>
        </div>
      </div>

      <section className="workspace-panel">
        <div className="workspace-toolbar">
          <div className="workspace-search">
            <Search size={17} />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search projects..."
            />
          </div>
          <div className="workspace-filters">
            {['All', 'In progress', 'Planning', 'Almost done', 'Completed'].map(item => (
              <button
                key={item}
                className={filter === item ? 'filter-active' : ''}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="workspace-empty">
            <span>Loading your projects...</span>
          </div>
        ) : (
          <>
            <div className="project-cards">
              {filtered.map(project => (
                <article className="workspace-project-card" key={project.id}>
                  {editingId === project.id ? (
                    <div className="project-edit-form">
                      <label>Project name</label>
                      <input
                        value={editForm.name}
                        onChange={event => setEditForm({ ...editForm, name: event.target.value })}
                      />

                      <label>Category</label>
                      <input
                        value={editForm.category}
                        onChange={event => setEditForm({ ...editForm, category: event.target.value })}
                      />

                      <label>Status</label>
                      <select
                        value={editForm.status}
                        onChange={event => setEditForm({ ...editForm, status: event.target.value })}
                      >
                        <option>Planning</option>
                        <option>In progress</option>
                        <option>Almost done</option>
                        <option>Completed</option>
                      </select>

                      <label>
                        Progress is calculated automatically from completed tasks.
                      </label>

                      <label>Due date</label>
                      <input
                        type="date"
                        value={editForm.due}
                        onChange={event => setEditForm({ ...editForm, due: event.target.value })}
                      />

                      <div className="project-edit-actions">
                        <button onClick={saveProject} disabled={saving || !editForm.name.trim()}>
                          <Save size={15} /> {saving ? 'Saving...' : 'Save changes'}
                        </button>
                        <button onClick={() => setEditingId(null)} disabled={saving}>
                          <X size={15} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="workspace-card-top">
                        <div className="workspace-project-icon">
                          <FolderKanban size={20} />
                        </div>
                        <span className="workspace-status">{project.status}</span>
                      </div>
                      <span className="workspace-category">{project.category}</span>
                      <h3>{project.name}</h3>
                      <div className="workspace-progress-meta">
                        <span>{taskCounts[project.id]?.completed ?? 0} of {taskCounts[project.id]?.total ?? 0} tasks completed</span>
                        <strong>{project.progress}%</strong>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <div className="workspace-card-footer">
                        <span><CalendarDays size={13} /> {project.due}</span>
                      </div>
                      <div className="project-card-actions">
                        <button onClick={() => startEditing(project)} disabled={saving}>
                          <Pencil size={15} /> Edit
                        </button>
                        <button
                          className="project-delete-button"
                          onClick={() => deleteProject(project)}
                          disabled={saving}
                        >
                          <Trash2 size={15} /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="workspace-empty">
                <strong>No projects found</strong>
                <span>Try another search or status filter.</span>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

export default Projects
