export type NotificationInput = {
  userId: string
  title: string
  message: string
  type: string
  link: string
}

export type WorkspaceNotificationStore = {
  getNotificationPreference(userId: string): Promise<{
    enabled: boolean | null
    error: string | null
  }>
  insertNotification(notification: {
    user_id: string
    title: string
    message: string
    type: string
    link: string
  }): Promise<{ error: string | null }>
}

export async function createWorkspaceNotificationWithStore(
  notification: NotificationInput,
  store: WorkspaceNotificationStore,
): Promise<string | null> {
  try {
    const { enabled, error: settingsError } =
      await store.getNotificationPreference(notification.userId)

    if (settingsError) return settingsError
    if (enabled === false) return null

    const { error: insertError } = await store.insertNotification({
      user_id: notification.userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      link: notification.link,
    })

    return insertError
  } catch (error) {
    return error instanceof Error ? error.message : 'Unknown notification error.'
  }
}
