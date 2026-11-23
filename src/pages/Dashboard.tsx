import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Users,
  Plus,
  CalendarDays,
  Activity,
  Bell,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'
import { calculateDashboardMetrics, getCompletionTrend } from '../lib/dashboard-metrics'
import { getLocalDateKey, isDateBeforeToday, parseDateKey } from '../lib/date-utils'

type Project = {
  id: number
  name: string
  category: string
  progress: number
  status: string
  due: string
  created_at: string
  archived_at: string | null
}

type Task = {
  id: number
  project_id: number | null
  title: string
  project: string
  status: string
  priority: string
  due: string
  created_at: string
  completed_at: string | null
}

type ActivityNotification = {
  id: number
  title: string
  message: string
  type: string
  created_at: string
}

function formatDeadline(value: string) {
  const dateKey = parseDateKey(value)
  if (!dateKey) return 'Not scheduled'
  const date = new Date(`${dateKey}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (dateKey === getLocalDateKey(today)) return 'Today'
  if (dateKey === getLocalDateKey(tomorrow)) return 'Tomorrow'

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
  const navigate = useNavigate()
  const [now] = useState(() => Date.now())

  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [directoryCount, setDirectoryCount] = useState(0)
  const [recentActivity, setRecentActivity] = useState<ActivityNotification[]>([])
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return

    const currentUser = user
    let active = true

    async function loadDashboard() {
      setLoading(true)
      setError('')

      const [projectResult, taskResult, memberResult, settingsResult, activityResult] =
        await Promise.all([
          supabase
            .from('projects')
            .select('id,name,category,progress,status,due,created_at,archived_at')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false }),

          supabase
            .from('tasks')
              .select('id,project_id,title,project,status,priority,due,created_at,completed_at')
              .eq('user_id', currentUser.id)
              .order('created_at', { ascending: false }),

          supabase
            .from('team_members')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', currentUser.id),

          supabase
            .from('user_settings')
            .select('full_name')
            .eq('user_id', currentUser.id)
            .maybeSingle(),

          supabase
            .from('notifications')
            .select('id,title,message,type,created_at')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(5),
        ])

      if (!active) return

      const failed =
        projectResult.error ||
        taskResult.error ||
        memberResult.error ||
        settingsResult.error ||
        activityResult.error

      if (failed) {
        setError(failed.message)
        setLoading(false)
        return
      }

      setProjects((projectResult.data ?? []) as Project[])
      setTasks((taskResult.data ?? []) as Task[])
      setDirectoryCount(memberResult.count ?? 0)
      setRecentActivity((activityResult.data ?? []) as ActivityNotification[])

      setFullName(
        settingsResult.data?.full_name ||
        currentUser.user_metadata?.full_name ||
        currentUser.email?.split('@')[0] ||
        'there'
      )

      setLoading(false)
    }

    void loadDashboard().catch((loadError: unknown) => {
      if (!active) return
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load dashboard data.'
      )
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [user])

  const metrics = calculateDashboardMetrics(projects, tasks, new Date(now))
  const completionTrend = getCompletionTrend(tasks, new Date(now))
  const trendMaximum = Math.max(1, ...completionTrend.map(day => day.count))
  const trendPoints = completionTrend.map((day, index) => {
    const x = 26 + index * 108
    const y = 124 - (day.count / trendMaximum) * 90
    return `${x},${y}`
  }).join(' ')

  const upcomingDeadlines = tasks
    .filter(task => {
      return task.status !== 'Completed' &&
        task.due !== 'Not scheduled' &&
        parseDateKey(task.due) !== null &&
        !isDateBeforeToday(task.due, new Date(now))
    })
    .sort(
      (a, b) =>
        (parseDateKey(a.due) ?? '').localeCompare(parseDateKey(b.due) ?? '')
    )
    .slice(0, 3)

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
          onClick={() => navigate('/projects?create=1')}
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
          { label: 'Total projects', value: metrics.totalProjects, change: `${metrics.activeProjects} active`, icon: BriefcaseBusiness },
          { label: 'Active projects', value: metrics.activeProjects, change: 'Excludes completed and archived', icon: BriefcaseBusiness },
          { label: 'Completed projects', value: metrics.completedProjects, change: 'Completed status', icon: CheckCircle2 },
          { label: 'Total tasks', value: metrics.totalTasks, change: `${metrics.pendingTasks} pending`, icon: CheckCircle2 },
          { label: 'Completed tasks', value: metrics.completedTasks, change: 'Completed status', icon: CheckCircle2 },
          { label: 'Pending tasks', value: metrics.pendingTasks, change: 'Not completed', icon: Clock3 },
          { label: 'Overdue tasks', value: metrics.overdueTasks, change: metrics.overdueTasks ? 'Needs attention' : 'All clear', icon: Clock3 },
          { label: 'Task completion', value: metrics.completionRate === null ? '—' : `${metrics.completionRate}%`, change: metrics.completionRate === null ? 'No tasks yet' : 'Completed / total tasks', icon: Activity },
          { label: 'Team directory records', value: directoryCount, change: 'Contacts, not account memberships', icon: Users },
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
              onClick={() => navigate('/projects')}
            >
              View all <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="project-list">
            {loading ? (
              <p className="dashboard-empty">Loading projects...</p>
            ) : projects.filter(project => !project.archived_at && project.status !== 'Archived').length === 0 ? (
              <p className="dashboard-empty">No projects yet. Create your first project to get started.</p>
            ) : (
              projects
                .filter(project => !project.archived_at && project.status !== 'Archived')
                .slice(0, 4)
                .map(project => {
                const projectTasks = tasks.filter(task => task.project_id === project.id)
                const progress = projectTasks.length
                  ? Math.round(
                      projectTasks.filter(task => task.status === 'Completed').length /
                        projectTasks.length *
                        100
                    )
                  : 0

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
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="progress-meta">
                      <span>{project.status}</span>
                      <strong>{progress}%</strong>
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
            onClick={() => navigate('/tasks')}
          >
            View all tasks <ArrowUpRight size={14} />
          </button>
        </article>
      </section>

      <section className="panel completion-trend-panel">
        <div className="panel-heading">
          <div>
            <h2>Task completion trend</h2>
            <p>Tasks completed each day over the last seven days.</p>
          </div>
          <Activity size={18} className="heading-icon" />
        </div>
        {loading ? (
          <p className="dashboard-empty">Loading completion history...</p>
        ) : completionTrend.every(day => day.count === 0) ? (
          <p className="dashboard-empty">
            No completion history recorded yet. Completion tracking starts when you complete tasks.
          </p>
        ) : (
          <div className="completion-trend-chart">
            <svg
              viewBox="0 0 700 150"
              role="img"
              aria-label={`Task completions over the last seven days: ${completionTrend.map(day => `${day.label} ${day.count}`).join(', ')}`}
            >
              <line x1="20" y1="126" x2="680" y2="126" className="trend-axis" />
              <polyline points={trendPoints} className="trend-line" />
              {completionTrend.map((day, index) => {
                const x = 26 + index * 108
                const y = 124 - (day.count / trendMaximum) * 90
                return (
                  <circle
                    key={day.key}
                    cx={x}
                    cy={y}
                    r="4"
                    className="trend-point"
                  />
                )
              })}
            </svg>
            <div className="trend-labels" aria-hidden="true">
              {completionTrend.map(day => (
                <span key={day.key}>{day.label}<strong>{day.count}</strong></span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="panel activity-panel">
        <div className="panel-heading">
          <div>
            <h2>Recent activity</h2>
            <p>Persisted notifications from supported workspace actions.</p>
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
                <div className="activity-avatar" aria-hidden="true">
                  {item.type === 'task' ? <CheckCircle2 size={16} /> : item.type === 'project' ? <BriefcaseBusiness size={16} /> : item.type === 'deadline' ? <Clock3 size={16} /> : <Bell size={16} />}
                </div>
                <div className="activity-description">
                  <strong>{item.title}</strong>
                  <b>{item.message}</b>
                </div>
                <span className="activity-time">{timeAgo(item.created_at)}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

export default Dashboard
