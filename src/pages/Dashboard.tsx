import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Users,
  Plus,
  CalendarDays,
  Activity,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type Project = {
  id: number
  name: string
  category: string
  progress: number
  status: string
  due: string
  created_at: string
}

type Task = {
  id: number
  title: string
  project: string
  status: string
  priority: string
  due: string
  created_at: string
}

type Member = {
  id: number
  name: string
  created_at: string
}

function formatDeadline(value: string) {
  if (!value || value === 'Not scheduled') return 'Not scheduled'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const target = new Date(date)
  target.setHours(0, 0, 0, 0)

  if (target.getTime() === today.getTime()) return 'Today'
  if (target.getTime() === tomorrow.getTime()) return 'Tomorrow'

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function timeAgo(value: string) {
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return 'Recently'

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hours ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

function Dashboard() {
  const { user } = useAuth()

  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const currentUser = user
    let active = true

    async function loadDashboard() {
      setLoading(true)
      setError('')

      const [projectResult, taskResult, memberResult, settingsResult] =
        await Promise.all([
          supabase
            .from('projects')
            .select('id,name,category,progress,status,due,created_at')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false }),

          supabase
            .from('tasks')
            .select('id,title,project,status,priority,due,created_at')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false }),

          supabase
            .from('team_members')
            .select('id,name,created_at')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false }),

          supabase
            .from('user_settings')
            .select('full_name')
            .eq('user_id', currentUser.id)
            .maybeSingle(),
        ])

      if (!active) return

      const failed =
        projectResult.error ||
        taskResult.error ||
        memberResult.error ||
        settingsResult.error

      if (failed) {
        setError(failed.message)
        setLoading(false)
        return
      }

      setProjects((projectResult.data ?? []) as Project[])
      setTasks((taskResult.data ?? []) as Task[])
      setMembers((memberResult.data ?? []) as Member[])

      setFullName(
        settingsResult.data?.full_name ||
        currentUser.user_metadata?.full_name ||
        currentUser.email?.split('@')[0] ||
        'there'
      )

      setLoading(false)
    }

    loadDashboard()

    return () => {
      active = false
    }
  }, [user])

  const activeProjects = projects.filter(
    project => project.status.toLowerCase() !== 'completed'
  )

  const completedTasks = tasks.filter(
    task => task.status === 'Completed'
  )

  const overdueTasks = tasks.filter(task => {
    if (
      task.status === 'Completed' ||
      !task.due ||
      task.due === 'Not scheduled'
    ) return false

    const dueDate = new Date(task.due)
    if (Number.isNaN(dueDate.getTime())) return false

    dueDate.setHours(23, 59, 59, 999)
    return dueDate.getTime() < Date.now()
  })

  const upcomingDeadlines = tasks
    .filter(task => {
      if (
        task.status === 'Completed' ||
        !task.due ||
        task.due === 'Not scheduled'
      ) return false

      const dueDate = new Date(task.due)
      return !Number.isNaN(dueDate.getTime())
    })
    .sort(
      (a, b) =>
        new Date(a.due).getTime() - new Date(b.due).getTime()
    )
    .slice(0, 3)

  const recentActivity = [
    ...tasks.map(task => ({
      id: `task-${task.id}`,
      name: fullName || 'You',
      initials: (fullName || 'You')
        .split(' ')
        .map(part => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      action:
        task.status === 'Completed'
          ? 'completed a task'
          : 'created a task',
      target: task.title,
      time: task.created_at,
      type: 'task',
    })),
    ...projects.map(project => ({
      id: `project-${project.id}`,
      name: fullName || 'You',
      initials: (fullName || 'You')
        .split(' ')
        .map(part => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      action: 'created a project',
      target: project.name,
      time: project.created_at,
      type: 'project',
    })),
    ...members.map(member => ({
      id: `member-${member.id}`,
      name: fullName || 'You',
      initials: (fullName || 'You')
        .split(' ')
        .map(part => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      action: 'added a team member',
      target: member.name,
      time: member.created_at,
      type: 'member',
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.time).getTime() - new Date(a.time).getTime()
    )
    .slice(0, 5)

  return (
    <div className="dashboard">
      <section className="dashboard-heading">
        <div>
          <span className="eyebrow">WORKSPACE OVERVIEW</span>
          <h1>Welcome back, {fullName || 'there'} <span>✦</span></h1>
          <p>Here's what's happening across your workspace today.</p>
        </div>
        <button
          className="dashboard-create"
          onClick={() => window.location.assign('/projects')}
        >
          <Plus size={16} />
          New project
        </button>
      </section>

      {error && (
        <div className="workspace-error">
          Could not load dashboard data: {error}
        </div>
      )}

      <section className="stats-grid">
        {[
          {
            label: 'Active projects',
            value: activeProjects.length,
            change: `${projects.length} total projects`,
            icon: BriefcaseBusiness,
          },
          {
            label: 'Completed tasks',
            value: completedTasks.length,
            change: `${tasks.length} total tasks`,
            icon: CheckCircle2,
          },
          {
            label: 'Overdue tasks',
            value: overdueTasks.length,
            change: overdueTasks.length ? 'Needs attention' : 'All clear',
            icon: Clock3,
          },
          {
            label: 'Team members',
            value: members.length,
            change: 'Workspace members',
            icon: Users,
          },
        ].map(stat => {
          const Icon = stat.icon

          return (
            <article className="stat-card" key={stat.label}>
              <div className="stat-top">
                <span>{stat.label}</span>
                <div className="stat-icon"><Icon size={18} /></div>
              </div>
              <strong className="stat-value">
                {loading ? '—' : stat.value}
              </strong>
              <span className="stat-change">
                {loading ? 'Loading...' : stat.change}
              </span>
            </article>
          )
        })}
      </section>

      <section className="dashboard-grid">
        <article className="panel projects-panel">
          <div className="panel-heading">
            <div>
              <h2>Project overview</h2>
              <p>Track progress across your active projects.</p>
            </div>
            <button
              className="subtle-button"
              onClick={() => window.location.assign('/projects')}
            >
              View all <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="project-list">
            {loading ? (
              <p className="dashboard-empty">Loading projects...</p>
            ) : projects.length === 0 ? (
              <p className="dashboard-empty">No projects yet. Create your first project to get started.</p>
            ) : (
              projects.slice(0, 4).map((project, index) => {
                const colors = ['#c6a76a', '#8b9ed1', '#b58bd4', '#6eb9a2']

                return (
                  <div className="project-row" key={project.id}>
                    <div className="project-info">
                      <div>
                        <strong>{project.name}</strong>
                        <span>{project.category || 'General'}</span>
                      </div>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${project.progress}%`,
                          background: colors[index % colors.length],
                        }}
                      />
                    </div>
                    <div className="progress-meta">
                      <span>{project.status}</span>
                      <strong>{project.progress}%</strong>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </article>

        <article className="panel deadlines-panel">
          <div className="panel-heading">
            <div>
              <h2>Upcoming deadlines</h2>
              <p>Keep your next deliverables on track.</p>
            </div>
            <CalendarDays size={18} className="heading-icon" />
          </div>

          <div className="deadline-list">
            {loading ? (
              <p className="dashboard-empty">Loading deadlines...</p>
            ) : upcomingDeadlines.length === 0 ? (
              <p className="dashboard-empty">No upcoming deadlines.</p>
            ) : (
              upcomingDeadlines.map(task => (
                <div className="deadline-item" key={task.id}>
                  <div className="deadline-marker" />
                  <div className="deadline-content">
                    <strong>{task.title}</strong>
                    <span>{task.project}</span>
                    <div className="deadline-meta">
                      <span>{formatDeadline(task.due)}</span>
                      <span className={`priority priority-${task.priority.toLowerCase()}`}>
                        {task.priority}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            className="view-tasks"
            onClick={() => window.location.assign('/tasks')}
          >
            View all tasks <ArrowUpRight size={14} />
          </button>
        </article>
      </section>

      <section className="panel activity-panel">
        <div className="panel-heading">
          <div>
            <h2>Recent activity</h2>
            <p>The latest updates from your workspace.</p>
          </div>
          <Activity size={18} className="heading-icon" />
        </div>

        <div className="activity-list">
          {loading ? (
            <p className="dashboard-empty">Loading activity...</p>
          ) : recentActivity.length === 0 ? (
            <p className="dashboard-empty">Your recent activity will appear here.</p>
          ) : (
            recentActivity.map(item => (
              <div className="activity-item" key={item.id}>
                <div className="activity-avatar">{item.initials}</div>
                <div className="activity-description">
                  <strong>{item.name}</strong> {item.action} <b>{item.target}</b>
                </div>
                <span className="activity-time">{timeAgo(item.time)}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

export default Dashboard
