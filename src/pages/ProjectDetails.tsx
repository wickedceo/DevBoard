import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, FolderKanban } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'

type Project = {
  id: number
  name: string
  category: string
  status: string
  due: string
  description: string
  archived_at: string | null
}

type ProjectTask = {
  id: number
  title: string
  status: string
  priority: string
  due: string
  description: string
}

function ProjectDetails() {
  const { projectId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadProject() {
      const id = Number(projectId)
      if (!user || !Number.isSafeInteger(id) || id < 1) {
        setError('This project could not be found.')
        setLoading(false)
        return
      }

      const [projectResult, taskResult] = await Promise.all([
        supabase
          .from('projects')
          .select('id,name,category,status,due,description,archived_at')
          .eq('id', id)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('tasks')
          .select('id,title,status,priority,due,description')
          .eq('project_id', id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ])

      if (!active) return

      if (projectResult.error || taskResult.error) {
        setError(projectResult.error?.message ?? taskResult.error?.message ?? 'Could not load project details.')
      } else if (!projectResult.data) {
        setError('This project could not be found.')
      } else {
        setProject(projectResult.data as Project)
        setTasks((taskResult.data ?? []) as ProjectTask[])
      }

      setLoading(false)
    }

    void loadProject().catch((loadError: unknown) => {
      if (!active) return
      setError(loadError instanceof Error ? loadError.message : 'Could not load project details.')
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [projectId, user])

  const completedTasks = tasks.filter(task => task.status === 'Completed').length
  const progress = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0

  if (loading) {
    return <div className="workspace-page" role="status">Loading project...</div>
  }

  if (!project || error) {
    return (
      <div className="workspace-page">
        <button className="subtle-button" onClick={() => navigate('/projects')}>
          <ArrowLeft size={15} /> Back to projects
        </button>
        <p className="workspace-error" role="alert">{error || 'This project could not be found.'}</p>
      </div>
    )
  }

  return (
    <div className="workspace-page">
      <button className="subtle-button project-back" onClick={() => navigate('/projects')}>
        <ArrowLeft size={15} /> Back to projects
      </button>

      <section className="project-detail-header workspace-panel">
        <div className="workspace-project-icon"><FolderKanban size={20} /></div>
        <div>
          <span className="eyebrow">{project.category || 'PROJECT'}</span>
          <h1>{project.name}</h1>
          <p>{project.archived_at ? 'Archived' : project.status}</p>
        </div>
        <div className="project-detail-meta">
          <span><CalendarDays size={15} /> Due {project.due || 'Not scheduled'}</span>
          <span><CheckCircle2 size={15} /> {completedTasks} of {tasks.length} tasks complete</span>
        </div>
        <div className="progress-track" aria-label={`${progress}% complete`}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </section>

      {project.description && (
        <section className="workspace-panel project-detail-description">
          <h2>About this project</h2>
          <p>{project.description}</p>
        </section>
      )}

      <section className="workspace-panel">
        <div className="panel-heading">
          <div>
            <h2>Project tasks</h2>
            <p>Tasks linked to this project.</p>
          </div>
          <button
            className="workspace-primary"
            onClick={() => navigate(`/tasks?project=${project.id}`)}
          >
            View tasks
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="workspace-empty">
            <strong>No tasks yet</strong>
            <span>Create a task and associate it with this project.</span>
          </div>
        ) : (
          <div className="task-list">
            {tasks.map(task => (
              <article className="task-row" key={task.id}>
                <div className="task-main">
                  <strong>{task.title}</strong>
                  {task.description && <span>{task.description}</span>}
                  <span>{task.status}</span>
                </div>
                <span className={`task-priority priority-${task.priority.toLowerCase()}`}>
                  {task.priority}
                </span>
                <span className="task-due"><Clock3 size={13} /> {task.due}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default ProjectDetails
