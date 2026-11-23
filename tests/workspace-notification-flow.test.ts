import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createWorkspaceNotificationWithStore,
  type NotificationInput,
  type WorkspaceNotificationStore,
} from '../src/lib/workspace-notification-flow.ts'

const notification: NotificationInput = {
  userId: 'user-123',
  title: 'Task completed',
  message: 'A task was completed.',
  type: 'task',
  link: '/tasks',
}

function createStore(
  overrides: Partial<WorkspaceNotificationStore> = {},
): WorkspaceNotificationStore {
  return {
    getNotificationPreference: async () => ({ enabled: true, error: null }),
    insertNotification: async () => ({ error: null }),
    ...overrides,
  }
}

test('respects disabled notification preferences without inserting', async () => {
  let inserted = false
  const store = createStore({
    getNotificationPreference: async () => ({ enabled: false, error: null }),
    insertNotification: async () => {
      inserted = true
      return { error: null }
    },
  })

  assert.equal(await createWorkspaceNotificationWithStore(notification, store), null)
  assert.equal(inserted, false)
})

test('does not insert when loading the preference fails', async () => {
  let inserted = false
  const store = createStore({
    getNotificationPreference: async () => ({
      enabled: null,
      error: 'Could not load preferences.',
    }),
    insertNotification: async () => {
      inserted = true
      return { error: null }
    },
  })

  assert.equal(
    await createWorkspaceNotificationWithStore(notification, store),
    'Could not load preferences.',
  )
  assert.equal(inserted, false)
})

test('inserts notifications for the supplied owner and returns insert failures', async () => {
  let insertedUserId = ''
  const store = createStore({
    insertNotification: async row => {
      insertedUserId = row.user_id
      return { error: 'Insert denied.' }
    },
  })

  assert.equal(
    await createWorkspaceNotificationWithStore(notification, store),
    'Insert denied.',
  )
  assert.equal(insertedUserId, notification.userId)
})

test('returns no error after the preference and notification save succeed', async () => {
  const store = createStore()

  assert.equal(await createWorkspaceNotificationWithStore(notification, store), null)
})

test('returns unexpected rejected store operations as errors', async () => {
  const store = createStore({
    getNotificationPreference: async () => {
      throw new Error('Request rejected.')
    },
  })

  assert.equal(
    await createWorkspaceNotificationWithStore(notification, store),
    'Request rejected.',
  )
})
