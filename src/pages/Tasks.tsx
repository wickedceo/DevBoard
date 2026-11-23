import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Plus,
  Search,
  CheckCircle2,
  Circle,
  Clock3,
  Trash2,
  ListTodo,
  Pencil,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'
import { createWorkspaceNotification } from '../lib/notifications'
import { parseDateKey } from '../lib/date-utils'

type TaskStatus = 'To do' | 'In progress' | 'Completed'
type TaskPriority = 'Low' | 'Medium' | 'High'

type ProjectOption = {
  id: number
  name: string
}

type Task = {
  id: number
  project_id: number | null
  title: string
  project: string
  status: TaskStatus
  priority: TaskPriority
  due: string
  description: string
  completed_at: string | null
  created_at?: string
}

function Tasks() {
  const { user, loading: authLoading } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [filter, setFilter] = useState('All')
  const [sortBy, setSortBy] = useState<'recent' | 'due' | 'priority'>('recent')
  const [showForm, setShowForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newProjectId, setNewProjectId] = useState('')
  const [newPriority, setNewPriority] = useState<TaskPriority>('Medium')
  const [newDue, setNewDue] = useState('')
  const [newDescription, setNewDescription] = useState('')

  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editProjectId, setEditProjectId] = useState('')
  const [editPriority, setEditPriority] = useState<TaskPriority>('Medium')
  const [editStatus, setEditStatus] = useState<TaskStatus>('To do')
  const [editDue, setEditDue] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const search = searchParams.get('search') ?? ''

  useEffect(() => {
    if (authLoading) return

    if (!user) return

    const currentUser = user
    let cancelled = false

    async function loadTasks() {
      setLoading(true)
      setError('')

      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('id, name')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (projectError) {
        setError(projectError.message)
      }
      const availableProjects = (projectData ?? []) as ProjectOption[]
      setProjects(availableProjects)

      const { data, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      if (data && data.length > 0) {
        setTasks(data as Task[])
        setLoading(false)
        return
      }

      setTasks([])
      setLoading(false)
    }

    void loadTasks().catch((loadError: unknown) => {
      if (cancelled) return
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load tasks.'
      )
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch =
        task.title.toLowerCase().includes(search.toLowerCase()) ||
        task.project.toLowerCase().includes(search.toLowerCase()) ||
        (task.description ?? '').toLowerCase().includes(search.toLowerCase())

      const matchesFilter = filter === 'All' || task.status === filter
      const selectedProjectId = searchParams.get('project')
      const matchesProject = !selectedProjectId || String(task.project_id) === selectedProjectId

      return matchesSearch && matchesFilter && matchesProject
    }).sort((a, b) => {
      if (sortBy === 'priority') {
        const rank = { High: 0, Medium: 1, Low: 2 }
        return rank[a.priority] - rank[b.priority]
      }
      if (sortBy === 'due') {
        return (parseDateKey(a.due) ?? '9999-12-31').localeCompare(
          parseDateKey(b.due) ?? '9999-12-31'
        )
      }
      return (b.created_at ?? '').localeCompare(a.created_at ?? '')
    })
  }, [tasks, search, filter, searchParams, sortBy])

  async function addTask() {
    if (!newTitle.trim() || !user || saving) return

    setSaving(true)
    setError('')

    const selectedProject = projects.find(
      project => String(project.id) === newProjectId
    )

    try {
      const { data, error: insertError } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          project_id: selectedProject?.id ?? null,
          title: newTitle.trim(),
          project: selectedProject?.name ?? 'General',
          status: 'To do',
          priority: newPriority,
          due: newDue || 'Not scheduled',
          description: newDescription.trim(),
          completed_at: null,
        })
        .select()
        .single()

      if (insertError) {
        setError(insertError.message)
        return
      }
      if (!data) {
        setError('The task was not returned after saving. Please refresh and try again.')
        return
      }

      setTasks(current => [data as Task, ...current])
      const notificationError = await createWorkspaceNotification({
        userId: user.id,
        title: 'New task created',
        message: `You created "${data.title}" in ${data.project || 'General'}.`,
        type: 'task',
        link: '/tasks',
      })
      if (notificationError) setError(`Task saved, but its notification could not be saved: ${notificationError}`)
      setNewTitle('')
      setNewProjectId('')
      setNewPriority('Medium')
      setNewDue('')
      setNewDescription('')
      setShowForm(false)
    } catch (insertError) {
      setError(insertError instanceof Error ? insertError.message : 'Could not create task.')
    } finally {
      setSaving(false)
    }
  }

  function startEditing(task: Task) {
    setEditingTaskId(task.id)
    setEditTitle(task.title)

    const linkedProject =
      projects.find(project => project.id === task.project_id) ||
      projects.find(project => project.name.trim() === task.project.trim())

    setEditProjectId(linkedProject ? String(linkedProject.id) : '')
    setEditPriority(task.priority)
    setEditStatus(task.status)
    setEditDue(parseDateKey(task.due) ?? '')
    setEditDescription(task.description ?? '')
    setError('')
  }

  function cancelEditing() {
    setEditingTaskId(null)
    setEditTitle('')
    setEditProjectId('')
    setEditPriority('Medium')
    setEditStatus('To do')
    setEditDue('')
    setEditDescription('')
  }

  async function saveTaskEdit() {
    if (!user || editingTaskId === null || !editTitle.trim() || saving) return

    const task = tasks.find(item => item.id === editingTaskId)
    if (!task) return

    setSaving(true)
    setError('')

    const selectedProject = projects.find(
      project => String(project.id) === editProjectId
    )

    const updates = {
      title: editTitle.trim(),
      project_id: selectedProject?.id ?? null,
      project: selectedProject?.name ?? 'General',
      priority: editPriority,
      status: editStatus,
      due: editDue.trim() || 'Not scheduled',
      description: editDescription.trim(),
      completed_at: editStatus === 'Completed'
        ? task.status === 'Completed'
          ? task.completed_at
          : new Date().toISOString()
        : null,
    }

    try {
      const { data, error: updateError } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', editingTaskId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (updateError) {
        setError(updateError.message)
        return
      }
      if (!data) {
        setError('The task was not returned after saving. It may have been removed.')
        return
      }

      setTasks(current =>
        current.map(item => item.id === editingTaskId ? data as Task : item)
      )

      const notificationError = await createWorkspaceNotification({
        userId: user.id,
        title: 'Task updated',
        message: `"${data.title}" was updated successfully.`,
        type: 'task',
        link: '/tasks',
      })
      if (notificationError) setError(`Task saved, but its notification could not be saved: ${notificationError}`)

      cancelEditing()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update task.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleTask(id: number) {
    if (!user || saving) return

    const task = tasks.find(item => item.id === id)
    if (!task) return

    const nextStatus: TaskStatus =
      task.status === 'Completed' ? 'To do' : 'Completed'
    const completedAt = nextStatus === 'Completed' ? new Date().toISOString() : null

    setSaving(true)
    setError('')

    try {
      const { data, error: updateError } = await supabase
        .from('tasks')
        .update({
          status: nextStatus,
          completed_at: completedAt,
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (updateError) {
        setError(updateError.message)
        return
      }
      if (!data) {
        setError('The task was not returned after updating. It may have been removed.')
        return
      }

      setTasks(current =>
        current.map(item => item.id === id ? data as Task : item)
      )
      const notificationError = await createWorkspaceNotification({
        userId: user.id,
        title: nextStatus === 'Completed' ? 'Task completed' : 'Task reopened',
        message: `"${data.title}" was marked as ${data.status.toLowerCase()}.`,
        type: 'task',
        link: '/tasks',
      })
      if (notificationError) setError(`Task saved, but its notification could not be saved: ${notificationError}`)
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update task status.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteTask(id: number) {
    if (!user || saving) return

    const deletedTask = tasks.find(task => task.id === id)
    if (!deletedTask) {
      setError('This task is no longer available. Refresh the list and try again.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const { data, error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .select('id')
        .single()

      if (deleteError) {
        setError(deleteError.message)
        return
      }
      if (!data) {
        setError('The task was not returned after deletion. Refresh the list and try again.')
        return
      }

      setTasks(current => current.filter(task => task.id !== id))
      const notificationError = await createWorkspaceNotification({
        userId: user.id,
        title: 'Task deleted',
        message: `"${deletedTask.title}" was removed from your tasks.`,
        type: 'task',
        link: '/tasks',
      })
      if (notificationError) setError(`Task deleted, but its notification could not be saved: ${notificationError}`)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete task.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="workspace-page">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">WORKSPACE</span>
          <h1>Tasks</h1>
          <p>Organize priorities, track progress and get work done.</p>
        </div>

        <button
          className="workspace-primary"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={17} /> New task
        </button>
      </div>

      <div className="workspace-stats">
        <div className="workspace-stat">
          <span>Total tasks</span>
          <strong>{tasks.length}</strong>
        </div>
        <div className="workspace-stat">
          <span>To do</span>
          <strong>{tasks.filter(task => task.status === 'To do').length}</strong>
        </div>
        <div className="workspace-stat">
          <span>In progress</span>
          <strong>{tasks.filter(task => task.status === 'In progress').length}</strong>
        </div>
        <div className="workspace-stat">
          <span>Completed</span>
          <strong>{tasks.filter(task => task.status === 'Completed').length}</strong>
        </div>
      </div>

      {error && (
        <div className="workspace-empty" role="alert">
          <strong>Something went wrong</strong>
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <form
          className="workspace-form task-form"
          onSubmit={event => {
            event.preventDefault()
            addTask()
          }}
        >
          <input
            aria-label="Task title"
            value={newTitle}
            onChange={event => setNewTitle(event.target.value)}
            placeholder="What needs to be done?"
            required
          />
          <select
            aria-label="Project"
            value={newProjectId}
            onChange={event => setNewProjectId(event.target.value)}
          >
            <option value="">No project</option>
            {projects.map(project => (
              <option key={project.id} value={String(project.id)}>
                {project.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Priority"
            value={newPriority}
            onChange={event => setNewPriority(event.target.value as TaskPriority)}
          >
            <option value="Low">Low priority</option>
            <option value="Medium">Medium priority</option>
            <option value="High">High priority</option>
          </select>
          <input
            type="date"
            value={newDue}
            onChange={event => setNewDue(event.target.value)}
            aria-label="Due date"
          />
          <textarea
            aria-label="Task description"
            value={newDescription}
            onChange={event => setNewDescription(event.target.value)}
            placeholder="Task details (optional)"
            rows={2}
          />
          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Create task'}
          </button>
          <button
            type="button"
            className="workspace-cancel"
            onClick={() => setShowForm(false)}
          >
            Cancel
          </button>
        </form>
      )}

      {editingTaskId !== null && (
        <form
          className="workspace-form task-form"
          onSubmit={event => {
            event.preventDefault()
            saveTaskEdit()
          }}
        >
          <strong className="task-edit-heading">Edit task</strong>

          <input
            value={editTitle}
            onChange={event => setEditTitle(event.target.value)}
            placeholder="Task title"
            required
          />

          <select
            value={editProjectId}
            onChange={event => setEditProjectId(event.target.value)}
          >
            <option value="">No project</option>
            {projects.map(project => (
              <option key={project.id} value={String(project.id)}>
                {project.name}
              </option>
            ))}
          </select>

          <select
            value={editPriority}
            onChange={event => setEditPriority(event.target.value as TaskPriority)}
          >
            <option value="Low">Low priority</option>
            <option value="Medium">Medium priority</option>
            <option value="High">High priority</option>
          </select>

          <select
            value={editStatus}
            onChange={event => setEditStatus(event.target.value as TaskStatus)}
          >
            <option value="To do">To do</option>
            <option value="In progress">In progress</option>
            <option value="Completed">Completed</option>
          </select>

          <input
            type="date"
            aria-label="Due date"
            value={editDue}
            onChange={event => setEditDue(event.target.value)}
          />
          <textarea
            aria-label="Task description"
            value={editDescription}
            onChange={event => setEditDescription(event.target.value)}
            placeholder="Task details (optional)"
            rows={2}
          />

          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>

          <button
            type="button"
            className="workspace-cancel"
            onClick={cancelEditing}
            disabled={saving}
          >
            Cancel
          </button>
        </form>
      )}

      <section className="workspace-panel">
        <div className="workspace-toolbar">
          <div className="workspace-search">
            <Search size={17} />
            <input
              aria-label="Search tasks"
              value={search}
              onChange={event => {
                const nextParams = new URLSearchParams(searchParams)
                if (event.target.value) nextParams.set('search', event.target.value)
                else nextParams.delete('search')
                setSearchParams(nextParams, { replace: true })
              }}
              placeholder="Search tasks or projects..."
            />
          </div>

          <div className="workspace-filters">
            {['All', 'To do', 'In progress', 'Completed'].map(item => (
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
              <option value="due">Due date</option>
              <option value="priority">Priority</option>
            </select>
          </label>
        </div>

        <div className="task-list">
          {loading ? (
            <div className="workspace-empty">
              <span>Loading your tasks...</span>
            </div>
          ) : (
            filteredTasks.map(task => (
              <article className="task-row" key={task.id}>
                <button
                  className={`task-check ${task.status === 'Completed' ? 'task-is-complete' : ''}`}
                  onClick={() => toggleTask(task.id)}
                  disabled={saving}
                  aria-label={`Mark ${task.title} as ${task.status === 'Completed' ? 'to do' : 'completed'}`}
                >
                  {task.status === 'Completed'
                    ? <CheckCircle2 size={20} />
                    : <Circle size={20} />}
                </button>

                <div className="task-main">
                  <strong className={task.status === 'Completed' ? 'task-title-complete' : ''}>
                    {task.title}
                  </strong>
                  {task.description && <span>{task.description}</span>}
                  <span>
                    {projects.find(project => project.id === task.project_id)?.name ?? task.project ?? 'General'}
                  </span>
                </div>

                <span className={`task-priority priority-${task.priority.toLowerCase()}`}>
                  {task.priority}
                </span>

                <span className={`task-status task-status-${task.status.toLowerCase().replace(' ', '-')}`}>
                  {task.status}
                </span>

                <span className="task-due">
                  <Clock3 size={13} />
                  {task.due}
                </span>

                <button
                  className="task-edit"
                  onClick={() => startEditing(task)}
                  disabled={saving}
                  aria-label={`Edit ${task.title}`}
                  title="Edit task"
                >
                  <Pencil size={16} />
                </button>

                <button
                  className="task-delete"
                  onClick={() => deleteTask(task.id)}
                  disabled={saving}
                  aria-label={`Delete ${task.title}`}
                >
                  <Trash2 size={16} />
                </button>
              </article>
            ))
          )}
        </div>

        {!loading && filteredTasks.length === 0 && (
          <div className="workspace-empty">
            <ListTodo size={28} />
            <strong>No tasks found</strong>
            <span>Try another search or create a new task.</span>
          </div>
        )}
      </section>
    </div>
  )
}

export default Tasks
