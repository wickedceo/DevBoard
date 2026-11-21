
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type Task = {
  id: number
  title: string
  project: string
  status: string
  priority: string
  due: string
}

function Calendar() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => {
    async function loadTasks() {
      if (!user) return

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)

      if (error) {
        setError(error.message)
      } else {
        setTasks(data || [])
      }

      setLoading(false)
    }

    loadTasks()
  }, [user])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  const monthName = currentDate.toLocaleDateString('en', {
    month: 'long',
    year: 'numeric',
  })

  const changeMonth = (amount: number) => {
    setCurrentDate(new Date(year, month + amount, 1))
  }

  const selectedMonthTasks = tasks.filter(task => {
    if (!task.due) return false
    const date = new Date(`${task.due}T00:00:00`)
    return date.getFullYear() === year && date.getMonth() === month
  })

  const upcomingTasks = [...selectedMonthTasks].sort(
    (a, b) => a.due.localeCompare(b.due)
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
              const dayTasks = tasks.filter(task => task.due === dateKey)
              const isToday =
                today.getFullYear() === year &&
                today.getMonth() === month &&
                today.getDate() === day

              return (
                <div className={`calendar-day ${isToday ? 'calendar-today' : ''}`} key={day}>
                  <span className="calendar-day-number">{day}</span>
                  {dayTasks.slice(0, 2).map(task => (
                    <div className="calendar-event" key={task.id} title={task.title}>
                      {task.title}
                    </div>
                  ))}
                  {dayTasks.length > 2 && (
                    <small>+{dayTasks.length - 2} more</small>
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
              <strong>Upcoming deadlines</strong>
              <span>{upcomingTasks.length} tasks this month</span>
            </div>
          </div>

          {upcomingTasks.length === 0 ? (
            <div className="workspace-empty">
              <strong>No deadlines this month</strong>
              <span>Tasks with due dates will appear here.</span>
            </div>
          ) : (
            <div className="calendar-task-list">
              {upcomingTasks.map(task => (
                <article className="calendar-task" key={task.id}>
                  <div>
                    <strong>{task.title}</strong>
                    <span>{task.project || 'General'} · {task.due}</span>
                  </div>
                  <span className={`task-priority priority-${task.priority.toLowerCase()}`}>
                    {task.priority}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default Calendar
