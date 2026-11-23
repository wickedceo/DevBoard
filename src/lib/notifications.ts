import { supabase } from './supabase'

type NotificationInput = {
  userId: string
  title: string
  message: string
  type: string
  link: string
}

export async function createWorkspaceNotification({
  userId,
  title,
  message,
  type,
  link,
}: NotificationInput): Promise<string | null> {
  try {
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('notifications')
      .eq('user_id', userId)
      .maybeSingle()

    if (settingsError) return settingsError.message
    if (settings?.notifications === false) return null

    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type,
      link,
    })

    return error?.message ?? null
  } catch (error) {
    return error instanceof Error ? error.message : 'Unknown notification error.'
  }
}
