import { supabase } from './supabase'
import {
  createWorkspaceNotificationWithStore,
  type NotificationInput,
  type WorkspaceNotificationStore,
} from './workspace-notification-flow'

const supabaseNotificationStore: WorkspaceNotificationStore = {
  async getNotificationPreference(userId) {
    const { data, error } = await supabase
      .from('user_settings')
      .select('notifications')
      .eq('user_id', userId)
      .maybeSingle()

    return {
      enabled: data?.notifications ?? null,
      error: error?.message ?? null,
    }
  },
  async insertNotification(notification) {
    const { error } = await supabase.from('notifications').insert(notification)
    return { error: error?.message ?? null }
  },
}

export function createWorkspaceNotification(
  notification: NotificationInput,
): Promise<string | null> {
  return createWorkspaceNotificationWithStore(notification, supabaseNotificationStore)
}
