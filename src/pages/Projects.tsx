import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, FolderKanban, CalendarDays, Pencil, Trash2, Save, X, Archive, RotateCcw, Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'
import { createWorkspaceNotification } from '../lib/notifications'
import { parseDateKey } from '../lib/date-utils'

type Project = {
  id: number
  name: string
  category: string
  progress: number
  status: string
  due: string
  description: string
  archived_at: string | null
  created_at?: string
}

function toDateInputValue(value: string) {
  return parseDateKey(value) ?? ''
}

function Projects() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [taskCounts, setTaskCounts] = useState<
    Record<number, { total: number; completed: number }>
  >({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'due'>('recent')
  const [createFormOpen, setCreateFormOpen] = useState(false)
  const showForm = createFormOpen || searchParams.get('create') === '1'
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    category: '',
    status: 'Planning',
    due: '',
    description: '',
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

      const rows = data ?? []

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

    void loadProjects().catch((loadError: unknown) => {
      if (cancelled) return
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load projects.'
      )
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [user])

  const filtered = useMemo(() => projects.filter(project => {
    const matchesSearch =
      project.name.toLowerCase().includes(search.toLowerCase()) ||
      (project.description ?? '').toLowerCase().includes(search.toLowerCase())
    const archived = Boolean(project.archived_at) || project.status === 'Archived'
    const matchesFilter =
      filter === 'Archived'
        ? archived
        : !archived && (filter === 'All' || project.status === filter)
    return matchesSearch && matchesFilter
  }).sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    if (sortBy === 'due') {
      return (parseDateKey(a.due) ?? '9999-12-31').localeCompare(
        parseDateKey(b.due) ?? '9999-12-31'
      )
    }
    return (b.created_at ?? '').localeCompare(a.created_at ?? '')
  }), [projects, search, filter, sortBy])

  function closeCreateForm() {
    setCreateFormOpen(false)
    if (searchParams.has('create')) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('create')
      setSearchParams(nextParams, { replace: true })
    }
  }

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
        description: newDescription.trim(),
        archived_at: null,
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
    } else if (data) {
      setProjects(current => [data, ...current])
      setNewName('')
      setNewDescription('')
      closeCreateForm()

      const notificationError = await createWorkspaceNotification({
        userId: user.id,
        title: 'New project created',
        message: `${data.name} has been added to your workspace.`,
        type: 'project',
        link: '/projects',
      })
      if (notificationError) setError(`Project saved, but its notification could not be saved: ${notificationError}`)
    }

    setSaving(false)
  }

  function startEditing(project: Project) {
    setEditingId(project.id)
    setEditForm({
      name: project.name,
      category: project.category,
      status: project.status,
      due: toDateInputValue(project.due),
      description: project.description ?? '',
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
        description: editForm.description.trim(),
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
      const notificationError = await createWorkspaceNotification({
        userId: user.id,
        title: 'Project updated',
        message: `"${data.name}" was updated.`,
        type: 'project',
        link: `/projects/${data.id}`,
      })
      if (notificationError) setError(`Project saved, but its notification could not be saved: ${notificationError}`)
    }

    setSaving(false)
  }

  async function setProjectArchived(project: Project, archived: boolean) {
    if (!user || saving) return

    setSaving(true)
    setError('')

    const archivedAt = archived ? new Date().toISOString() : null
    const status = !archived && project.status === 'Archived' ? 'Planning' : project.status
    const { error: updateError } = await supabase
      .from('projects')
      .update({ archived_at: archivedAt, status })
      .eq('id', project.id)
      .eq('user_id', user.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setProjects(current => current.map(item =>
        item.id === project.id ? { ...item, archived_at: archivedAt, status } : item
      ))
      const notificationError = await createWorkspaceNotification({
        userId: user.id,
        title: archived ? 'Project archived' : 'Project restored',
        message: `"${project.name}" was ${archived ? 'archived' : 'restored'}.`,
        type: 'project',
        link: `/projects/${project.id}`,
      })
      if (notificationError) setError(`Project updated, but its notification could not be saved: ${notificationError}`)
    }

    setSaving(false)
  }

  async function deleteProject(project: Project) {
    if (!user || saving) return

    const linkedTaskCount = taskCounts[project.id]?.total ?? 0
    if (linkedTaskCount > 0) {
      setError(`"${project.name}" has ${linkedTaskCount} linked task${linkedTaskCount === 1 ? '' : 's'}. Archive it to preserve the tasks.`)
      return
    }

    const confirmed = window.confirm(
      `Permanently delete "${project.name}"? This cannot be undone.`
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

      const notificationError = await createWorkspaceNotification({
        userId: user.id,
        title: 'Project deleted',
        message: `${project.name} was removed from your workspace.`,
        type: 'project',
        link: '/projects',
      })
      if (notificationError) setError(`Project deleted, but its notification could not be saved: ${notificationError}`)
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
        <button
          className="workspace-primary"
          onClick={() => showForm ? closeCreateForm() : setCreateFormOpen(true)}
        >
          <Plus size={17} /> New project
        </button>
      </div>

      {showForm && (
        <div className="workspace-form">
          <input
            aria-label="Project name"
            value={newName}
            onChange={event => setNewName(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && addProject()}
            placeholder="Enter project name..."
          />
          <textarea
            aria-label="Project description"
            value={newDescription}
            onChange={event => setNewDescription(event.target.value)}
            placeholder="Describe this project (optional)"
            rows={2}
          />
          <button onClick={addProject} disabled={saving}>
            {saving ? 'Saving...' : 'Create project'}
          </button>
          <button className="workspace-cancel" onClick={closeCreateForm}>
            Cancel
          </button>
        </div>
      )}

      {error && <p className="projects-error" role="alert">{error}</p>}

      <div className="workspace-stats">
        <div className="workspace-stat">
          <span>Total projects</span>
          <strong>{projects.filter(project => !project.archived_at && project.status !== 'Archived').length}</strong>
        </div>
        <div className="workspace-stat">
          <span>In progress</span>
          <strong>{projects.filter(p => !p.archived_at && p.status === 'In progress').length}</strong>
        </div>
        <div className="workspace-stat">
          <span>Completed</span>
          <strong>{projects.filter(p => !p.archived_at && p.status === 'Completed').length}</strong>
        </div>
      </div>

      <section className="workspace-panel">
        <div className="workspace-toolbar">
          <div className="workspace-search">
            <Search size={17} />
            <input
              aria-label="Search projects"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search projects..."
            />
          </div>
          <div className="workspace-filters">
            {['All', 'In progress', 'Planning', 'Almost done', 'Completed', 'Archived'].map(item => (
              <button
                key={item}
                className={filter === item ? 'filter-active' : ''}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="workspace-sort">
            <span>Sort by</span>
            <select value={sortBy} onChange={event => setSortBy(event.target.value as typeof sortBy)}>
              <option value="recent">Recently created</option>
              <option value="name">Name</option>
              <option value="due">Due date</option>
            </select>
          </label>
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
                      <label htmlFor={`project-name-${project.id}`}>Project name</label>
                      <input
                        id={`project-name-${project.id}`}
                        value={editForm.name}
                        onChange={event => setEditForm({ ...editForm, name: event.target.value })}
                      />

                      <label htmlFor={`project-category-${project.id}`}>Category</label>
                      <input
                        id={`project-category-${project.id}`}
                        value={editForm.category}
                        onChange={event => setEditForm({ ...editForm, category: event.target.value })}
                      />

                      <label htmlFor={`project-status-${project.id}`}>Status</label>
                      <select
                        id={`project-status-${project.id}`}
                        value={editForm.status}
                        onChange={event => setEditForm({ ...editForm, status: event.target.value })}
                      >
                        <option>Planning</option>
                        <option>In progress</option>
                        <option>Almost done</option>
                        <option>Completed</option>
                      </select>

                      <label htmlFor={`project-description-${project.id}`}>Description</label>
                      <textarea
                        id={`project-description-${project.id}`}
                        value={editForm.description}
                        onChange={event => setEditForm({ ...editForm, description: event.target.value })}
                        rows={3}
                      />
                      <small>Progress is calculated automatically from completed tasks.</small>

                      <label htmlFor={`project-due-${project.id}`}>Due date</label>
                      <input
                        id={`project-due-${project.id}`}
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
                        <span className="workspace-status">
                          {project.archived_at || project.status === 'Archived' ? 'Archived' : project.status}
                        </span>
                      </div>
                      <span className="workspace-category">{project.category}</span>
                      <h3>{project.name}</h3>
                      {project.description && (
                        <p className="workspace-project-description">{project.description}</p>
                      )}
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
                        <button onClick={() => navigate(`/projects/${project.id}`)}>
                          <Eye size={15} /> View
                        </button>
                        <button onClick={() => startEditing(project)} disabled={saving}>
                          <Pencil size={15} /> Edit
                        </button>
                        <button
                          onClick={() => setProjectArchived(
                            project,
                            !(project.archived_at || project.status === 'Archived')
                          )}
                          disabled={saving}
                        >
                          {project.archived_at || project.status === 'Archived'
                            ? <><RotateCcw size={15} /> Restore</>
                            : <><Archive size={15} /> Archive</>}
                        </button>
                        <button
                          className="project-delete-button"
                          onClick={() => deleteProject(project)}
                          disabled={saving || (taskCounts[project.id]?.total ?? 0) > 0}
                          title={
                            (taskCounts[project.id]?.total ?? 0) > 0
                              ? 'Archive this project to preserve its linked tasks'
                              : 'Permanently delete project'
                          }
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
