import assert from 'node:assert/strict'
import test from 'node:test'
import { isDateBeforeToday, parseDateKey } from '../src/lib/date-utils.ts'

test('normalizes ISO and readable deadlines to local calendar dates', () => {
  assert.equal(parseDateKey('2026-11-22'), '2026-11-22')
  assert.equal(parseDateKey('Nov 22, 2026'), '2026-11-22')
})

test('rejects unscheduled, malformed and impossible calendar dates', () => {
  assert.equal(parseDateKey('Not scheduled'), null)
  assert.equal(parseDateKey('not a date'), null)
  assert.equal(parseDateKey('2026-02-30'), null)
})

test('marks only deadlines before today as overdue', () => {
  const today = new Date(2026, 10, 22, 12)

  assert.equal(isDateBeforeToday('2026-11-21', today), true)
  assert.equal(isDateBeforeToday('2026-11-22', today), false)
  assert.equal(isDateBeforeToday('2026-11-23', today), false)
})
