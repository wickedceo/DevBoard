
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'
import { getLocalDateKey, isDateBeforeToday, parseDateKey } from '../lib/date-utils'

type Task = {
  id: number
  project_id: number | null
  title: string
  project: string
  status: string
  priority: string
  due: string
}

type Project = {
  id: number
  name: string
  status: string
  due: string
}

type CalendarEvent = {
  id: string
  title: string
  date: string
  kind: 'task' | 'project'
  status: string
  priority?: string
  projectId?: number
}

function Calendar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => {
    let active = true

    async function loadTasks() {
      if (!user) {
        setLoading(false)
        return
      }

      const [taskResult, projectResult] = await Promise.all([
        supabase
          .from('tasks')
          .select('id,project_id,title,project,status,priority,due')
          .eq('user_id', user.id),
        supabase
          .from('projects')
          .select('id,name,status,due')
          .eq('user_id', user.id),
      ])

      if (!active) return

      if (taskResult.error || projectResult.error) {
        setError(taskResult.error?.message ?? projectResult.error?.message ?? 'Could not load your schedule.')
      } else {
        setTasks((taskResult.data ?? []) as Task[])
        setProjects((projectResult.data ?? []) as Project[])
      }

      setLoading(false)
    }

    void loadTasks().catch((loadError: unknown) => {
      if (!active) return
      setError(loadError instanceof Error ? loadError.message : 'Could not load your schedule.')
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [user])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const todayKey = getLocalDateKey(today)

  const monthName = currentDate.toLocaleDateString('en', {
    month: 'long',
    year: 'numeric',
  })

  const changeMonth = (amount: number) => {
    setCurrentDate(new Date(year, month + amount, 1))
  }

  const events: CalendarEvent[] = [
    ...tasks.map(task => ({
      id: `task-${task.id}`,
      title: task.title,
      date: task.due,
      kind: 'task' as const,
      status: task.status,
      priority: task.priority,
      projectId: task.project_id ?? undefined,
    })),
    ...projects.map(project => ({
      id: `project-${project.id}`,
      title: project.name,
      date: project.due,
      kind: 'project' as const,
      status: project.status,
      projectId: project.id,
    })),
  ]

  const selectedMonthEvents = events
    .filter(event => {
      const key = parseDateKey(event.date)
      return key !== null && key.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)
    })
    .sort(
      (a, b) => (parseDateKey(a.date) ?? '').localeCompare(parseDateKey(b.date) ?? '')
    )

  return (
    <div className="workspace-page">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">WORKSPACE</span>
          <h1>Calendar</h1>
          <p>Keep track of deadlines and important dates.</p>
        </div>
      </div>

      <div className="calendar-layout">
        <section className="workspace-panel calendar-panel">
          <div className="calendar-toolbar">
            <div>
              <span className="eyebrow">SCHEDULE</span>
              <h2>{monthName}</h2>
            </div>

            <div className="calendar-navigation">
              <button onClick={() => changeMonth(-1)} aria-label="Previous month">
                <ChevronLeft size={18} />
              </button>
              <button onClick={() => setCurrentDate(new Date())}>Today</button>
              <button onClick={() => changeMonth(1)} aria-label="Next month">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div className="calendar-weekday" key={day}>{day}</div>
            ))}

            {Array.from({ length: firstDay }, (_, index) => (
              <div className="calendar-day calendar-empty" key={`empty-${index}`} />
            ))}

            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1
              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayEvents = selectedMonthEvents.filter(event => parseDateKey(event.date) === dateKey)
              const isToday = dateKey === todayKey

              return (
                <div className={`calendar-day ${isToday ? 'calendar-today' : ''}`} key={day}>
                  <span className="calendar-day-number">{day}</span>
                  {dayEvents.slice(0, 2).map(event => (
                    <button
                      type="button"
                      className={`calendar-event ${event.kind === 'project' ? 'calendar-project-event' : ''} ${event.status === 'Completed' ? 'calendar-completed-event' : ''} ${isDateBeforeToday(event.date, today) && event.status !== 'Completed' ? 'calendar-overdue-event' : ''}`}
                      key={event.id}
                      title={`${event.kind === 'project' ? 'Project' : 'Task'}: ${event.title}`}
                      onClick={() => navigate(
                        event.kind === 'project'
                          ? `/projects/${event.projectId}`
                          : `/tasks?search=${encodeURIComponent(event.title)}`
                      )}
                    >
                      {event.kind === 'project' ? 'Project · ' : ''}{event.title}
                    </button>
                  ))}
                  {dayEvents.length > 2 && (
                    <small>+{dayEvents.length - 2} more</small>
                  )}
                </div>
              )
            })}
          </div>

          {loading && <p className="calendar-message">Loading your schedule...</p>}
          {error && <p className="workspace-error">{error}</p>}
        </section>

        <section className="workspace-panel calendar-upcoming">
          <div className="calendar-upcoming-heading">
            <CalendarDays size={19} />
            <div>
              <strong>Deadlines this month</strong>
              <span>{selectedMonthEvents.length} project and task deadlines</span>
            </div>
          </div>

          {selectedMonthEvents.length === 0 ? (
            <div className="workspace-empty">
              <strong>No deadlines this month</strong>
              <span>Tasks with due dates will appear here.</span>
            </div>
          ) : (
            <div className="calendar-task-list">
              {selectedMonthEvents.map(event => (
                <button
                  type="button"
                  className={`calendar-task ${isDateBeforeToday(event.date, today) && event.status !== 'Completed' ? 'calendar-task-overdue' : ''}`}
                  key={event.id}
                  onClick={() => navigate(
                    event.kind === 'project'
                      ? `/projects/${event.projectId}`
                      : `/tasks?search=${encodeURIComponent(event.title)}`
                  )}
                >
                  <div>
                    <strong>{event.kind === 'project' ? 'Project · ' : ''}{event.title}</strong>
                    <span>
                      {event.kind === 'task' && event.projectId
                        ? projects.find(project => project.id === event.projectId)?.name ?? 'General'
                        : event.kind === 'task' ? 'General' : event.status}
                      {' · '}{event.date}
                    </span>
                  </div>
                  {event.priority && (
                    <span className={`task-priority priority-${event.priority.toLowerCase()}`}>
                      {event.priority}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default Calendar
