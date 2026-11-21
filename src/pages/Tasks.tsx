import { useEffect, useMemo, useState } from 'react'
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
import { useAuth } from '../context/AuthContext'

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
}

const initialTasks: Omit<Task, 'id' | 'project_id'>[] = [
  { title: 'Finalize homepage design', project: 'Website Redesign', status: 'In progress', priority: 'High', due: 'Nov 14, 2026' },
  { title: 'Review mobile layouts', project: 'Mobile Application', status: 'To do', priority: 'Medium', due: 'Nov 16, 2026' },
  { title: 'Prepare launch checklist', project: 'Marketing Campaign', status: 'To do', priority: 'High', due: 'Nov 18, 2026' },
  { title: 'Fix navigation issues', project: 'Customer Portal', status: 'Completed', priority: 'Medium', due: 'Nov 10, 2026' },
  { title: 'Approve brand direction', project: 'Brand Identity', status: 'Completed', priority: 'Low', due: 'Nov 08, 2026' },
]

async function createTaskNotification(
  userId: string,
  title: string,
  message: string
) {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type: 'task',
    link: '/tasks',
  })

  if (error) {
    console.error('Could not create notification:', error.message)
  }
}

function Tasks() {
  const { user, loading: authLoading } = useAuth()

  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newProjectId, setNewProjectId] = useState('')
  const [newPriority, setNewPriority] = useState<TaskPriority>('Medium')
  const [newDue, setNewDue] = useState('')

  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editProjectId, setEditProjectId] = useState('')
  const [editPriority, setEditPriority] = useState<TaskPriority>('Medium')
  const [editStatus, setEditStatus] = useState<TaskStatus>('To do')
  const [editDue, setEditDue] = useState('')

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setTasks([])
      setLoading(false)
      return
    }

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
      } else {
        setProjects((projectData || []) as ProjectOption[])
      }

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

      // Import existing local tasks once, if the cloud table is empty.
      let oldTasks: Task[] = []

      try {
        const saved = localStorage.getItem('devboard-tasks')
        oldTasks = saved ? JSON.parse(saved) as Task[] : []
      } catch {
        oldTasks = []
      }

      const tasksToImport = oldTasks.length > 0
        ? oldTasks
        : initialTasks

      const { data: imported, error: importError } = await supabase
        .from('tasks')
        .insert(
          tasksToImport.map(task => ({
            user_id: currentUser.id,
            project_id: projects.find(
              project => project.name.trim() === task.project.trim()
            )?.id ?? null,
            title: task.title,
            project: task.project,
            status: task.status,
            priority: task.priority,
            due: task.due,
          }))
        )
        .select()

      if (cancelled) return

      if (importError) {
        setError(importError.message)
      } else {
        setTasks((imported || []) as Task[])
      }

      setLoading(false)
    }

    loadTasks()

    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch =
        task.title.toLowerCase().includes(search.toLowerCase()) ||
        task.project.toLowerCase().includes(search.toLowerCase())

      const matchesFilter = filter === 'All' || task.status === filter

      return matchesSearch && matchesFilter
    })
  }, [tasks, search, filter])

  async function addTask() {
    if (!newTitle.trim() || !user || saving) return

    setSaving(true)
    setError('')

    const selectedProject = projects.find(
      project => String(project.id) === newProjectId
    )

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
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
    } else {
      setTasks(current => [data as Task, ...current])
      await createTaskNotification(
        user.id,
        'New task created',
        `You created "${data.title}" in ${data.project || 'General'}.`
      )
      setNewTitle('')
      setNewProjectId('')
      setNewPriority('Medium')
      setNewDue('')
      setShowForm(false)
    }

    setSaving(false)
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
    setEditDue(task.due)
    setError('')
  }

  function cancelEditing() {
    setEditingTaskId(null)
    setEditTitle('')
    setEditProjectId('')
    setEditPriority('Medium')
    setEditStatus('To do')
    setEditDue('')
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
    }

    const { error: updateError } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', editingTaskId)
      .eq('user_id', user.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setTasks(current =>
        current.map(item =>
          item.id === editingTaskId ? { ...item, ...updates } : item
        )
      )

      await createTaskNotification(
        user.id,
        'Task updated',
        `"${updates.title}" was updated successfully.`
      )

      cancelEditing()
    }

    setSaving(false)
  }

  async function toggleTask(id: number) {
    if (!user || saving) return

    const task = tasks.find(item => item.id === id)
    if (!task) return

    const nextStatus: TaskStatus =
      task.status === 'Completed' ? 'To do' : 'Completed'

    setSaving(true)
    setError('')

    const { error: updateError } = await supabase
      .from('tasks')
      .update({ status: nextStatus })
      .eq('id', id)
      .eq('user_id', user.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setTasks(current =>
        current.map(item =>
          item.id === id ? { ...item, status: nextStatus } : item
        )
      )
      await createTaskNotification(
        user.id,
        nextStatus === 'Completed' ? 'Task completed' : 'Task reopened',
        `"${task.title}" was marked as ${nextStatus.toLowerCase()}.`
      )
    }

    setSaving(false)
  }

  async function deleteTask(id: number) {
    if (!user || saving) return

    setSaving(true)
    setError('')

    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      setError(deleteError.message)
    } else {
      const deletedTask = tasks.find(task => task.id === id)
      setTasks(current => current.filter(task => task.id !== id))

      if (deletedTask) {
        await createTaskNotification(
          user.id,
          'Task deleted',
          `"${deletedTask.title}" was removed from your tasks.`
        )
      }
    }

    setSaving(false)
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
        <div className="workspace-empty">
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
            value={newTitle}
            onChange={event => setNewTitle(event.target.value)}
            placeholder="What needs to be done?"
            required
          />
          <select
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
            type="text"
            value={editDue}
            onChange={event => setEditDue(event.target.value)}
            placeholder="Due date"
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
              value={search}
              onChange={event => setSearch(event.target.value)}
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
                  <span>{task.project}</span>
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
