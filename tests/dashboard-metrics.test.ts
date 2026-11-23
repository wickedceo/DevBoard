import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateDashboardMetrics, getCompletionTrend } from '../src/lib/dashboard-metrics.ts'

test('calculates real workspace totals and excludes archived projects from active', () => {
  const metrics = calculateDashboardMetrics(
    [
      { status: 'Planning' },
      { status: 'Completed' },
      { status: 'Planning', archived_at: '2026-11-20T12:00:00Z' },
      { status: 'Archived' },
    ],
    [
      { status: 'Completed', due: '2026-11-20' },
      { status: 'In progress', due: '2026-11-21' },
      { status: 'To do', due: '2026-11-23' },
    ],
    new Date(2026, 10, 22, 12),
  )

  assert.deepEqual(metrics, {
    totalProjects: 4,
    activeProjects: 1,
    completedProjects: 1,
    totalTasks: 3,
    completedTasks: 1,
    pendingTasks: 2,
    overdueTasks: 1,
    completionRate: 33,
  })
})

test('builds a seven-day completion trend only from persisted completion timestamps', () => {
  const trend = getCompletionTrend(
    [
      { completed_at: '2026-11-22T08:00:00Z' },
      { completed_at: '2026-11-22T10:00:00Z' },
      { completed_at: 'invalid' },
      { completed_at: null },
    ],
    new Date(2026, 10, 22, 12),
  )

  assert.equal(trend.length, 7)
  assert.equal(trend[6].key, '2026-11-22')
  assert.equal(trend[6].count, 2)
  assert.equal(trend.slice(0, 6).reduce((sum, day) => sum + day.count, 0), 0)
})

test('returns no completion rate for an empty task list', () => {
  const metrics = calculateDashboardMetrics([], [], new Date(2026, 10, 22))

  assert.equal(metrics.completionRate, null)
  assert.equal(metrics.overdueTasks, 0)
})
