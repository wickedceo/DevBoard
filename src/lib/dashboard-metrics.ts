import { getLocalDateKey, isDateBeforeToday } from './date-utils.ts'

type ProjectMetricInput = { status: string; archived_at?: string | null }
type TaskMetricInput = { status: string; due: string }

function isArchived(project: ProjectMetricInput) {
  return Boolean(project.archived_at) || project.status === 'Archived'
}

export function calculateDashboardMetrics(
  projects: ProjectMetricInput[],
  tasks: TaskMetricInput[],
  now: Date,
) {
  const completedProjects = projects.filter(project => project.status === 'Completed').length
  const activeProjects = projects.filter(project =>
    project.status !== 'Completed' && !isArchived(project),
  ).length
  const completedTasks = tasks.filter(task => task.status === 'Completed').length

  return {
    totalProjects: projects.length,
    activeProjects,
    completedProjects,
    totalTasks: tasks.length,
    completedTasks,
    pendingTasks: tasks.length - completedTasks,
    overdueTasks: tasks.filter(
      task => task.status !== 'Completed' && isDateBeforeToday(task.due, now),
    ).length,
    completionRate: tasks.length
      ? Math.round((completedTasks / tasks.length) * 100)
      : null,
  }
}

export function getCompletionTrend(
  tasks: { completed_at?: string | null }[],
  now: Date,
) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + index)
    return {
      key: getLocalDateKey(date),
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      count: 0,
    }
  })
  const counts = new Map(days.map(day => [day.key, day]))

  for (const task of tasks) {
    if (!task.completed_at) continue
    const timestamp = new Date(task.completed_at)
    if (Number.isNaN(timestamp.getTime())) continue
    const day = counts.get(getLocalDateKey(timestamp))
    if (day) day.count += 1
  }

  return days
}
