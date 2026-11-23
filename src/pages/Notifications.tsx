import { useEffect, useMemo, useState } from 'react'
import {
  Bell, CheckCheck, Trash2, CalendarDays, FolderKanban,
  Info, Clock3, Inbox, Check, Sparkles
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'

type NotificationItem = {
  id: number
  title: string
  message: string
  type: string
  is_read: boolean
  link: string | null
  created_at: string
}

type FilterType = 'all' | 'unread' | 'read'

function Notifications() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')

  useEffect(() => {
    let active = true

    const loadNotifications = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!active) return

      if (error) {
        setError(error.message)
      } else {
        setNotifications(data || [])
      }

      setLoading(false)
    }

    void loadNotifications().catch((loadError: unknown) => {
      if (!active) return
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load notifications.'
      )
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [user])

  const unreadCount = notifications.filter(item => !item.is_read).length
  const readCount = notifications.length - unreadCount

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') return notifications.filter(item => !item.is_read)
    if (filter === 'read') return notifications.filter(item => item.is_read)
    return notifications
  }, [notifications, filter])

  const markAsRead = async (id: number): Promise<boolean> => {
    if (!user || saving) return false

    setSaving(true)
    setError('')
    try {
      const { data, error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', user.id)
        .select('id')
        .single()

      if (updateError) {
        setError(updateError.message)
        return false
      }
      if (!data) {
        setError('This notification is no longer available. Refresh your inbox and try again.')
        return false
      }

      setNotifications(items =>
        items.map(item => item.id === id ? { ...item, is_read: true } : item)
      )
      return true
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not mark the notification as read.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const markAllAsRead = async () => {
    if (!user || saving || unreadCount === 0) return

    setSaving(true)
    setError('')
    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .select('id')

      if (updateError) {
        setError(updateError.message)
        return
      }

      setNotifications(items => items.map(item => ({ ...item, is_read: true })))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not mark notifications as read.')
    } finally {
      setSaving(false)
    }
  }

  const deleteNotification = async (id: number) => {
    if (!user || saving) return

    setSaving(true)
    setError('')
    try {
      const { data, error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .select('id')
        .single()

      if (deleteError) {
        setError(deleteError.message)
        return
      }
      if (!data) {
        setError('This notification is no longer available. Refresh your inbox and try again.')
        return
      }

      setNotifications(items => items.filter(item => item.id !== id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the notification.')
    } finally {
      setSaving(false)
    }
  }

  const openNotification = async (item: NotificationItem) => {
    if (!item.is_read && !(await markAsRead(item.id))) return
    if (item.link) navigate(item.link)
  }

  const getIcon = (type: string) => {
    if (type === 'task') return <CheckCheck size={19} />
    if (type === 'deadline') return <CalendarDays size={19} />
    if (type === 'project') return <FolderKanban size={19} />
    return <Info size={19} />
  }

  const getTypeLabel = (type: string) => {
    if (type === 'task') return 'TASK UPDATE'
    if (type === 'deadline') return 'DEADLINE'
    if (type === 'project') return 'PROJECT UPDATE'
    return 'WORKSPACE'
  }

  const formatDate = (date: string) => {
    const value = new Date(date)
    const now = new Date()
    const diff = now.getTime() - value.getTime()
    const day = 24 * 60 * 60 * 1000

    if (diff >= 0 && diff < 60 * 60 * 1000) {
      const minutes = Math.max(1, Math.floor(diff / 60000))
      return `${minutes} min${minutes === 1 ? '' : 's'} ago`
    }

    if (diff >= 0 && diff < day) {
      return value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    }

    if (diff >= 0 && diff < 2 * day) return 'Yesterday'

    return value.toLocaleDateString([], {
      day: 'numeric',
      month: 'short',
      year: value.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  return (
    <main className="notifications-v2">
      <header className="notifications-v2-header">
        <div>
          <div className="notifications-v2-eyebrow">
            <Sparkles size={13} />
            WORKSPACE CENTRE
          </div>
          <h1>Notifications<span>.</span></h1>
          <p>Everything happening across your workspace, in one place.</p>
        </div>

        {unreadCount > 0 && (
          <button className="notifications-v2-mark" onClick={markAllAsRead} disabled={saving}>
            <CheckCheck size={16} />
            Mark all as read
          </button>
        )}
      </header>

      <section className="notifications-v2-overview">
        <div className="notifications-v2-overview-main">
          <div className="notifications-v2-bell">
            <Bell size={23} />
            {unreadCount > 0 && <span />}
          </div>
          <div>
            <span className="notifications-v2-label">YOUR INBOX</span>
            <h2>{unreadCount === 0 ? 'You’re all caught up' : `${unreadCount} updates need your attention`}</h2>
            <p>
              {unreadCount === 0
                ? 'You have no unread notifications right now.'
                : 'Stay on top of your latest workspace activity.'}
            </p>
          </div>
        </div>

        <div className="notifications-v2-overview-total">
          <strong>{String(notifications.length).padStart(2, '0')}</strong>
          <span>TOTAL UPDATES</span>
        </div>
      </section>

      <section className="notifications-v2-stats">
        <div className="notifications-v2-stat">
          <div className="notifications-v2-stat-icon gold"><Bell size={17} /></div>
          <div><strong>{notifications.length}</strong><span>All notifications</span></div>
        </div>
        <div className="notifications-v2-stat">
          <div className="notifications-v2-stat-icon amber"><Clock3 size={17} /></div>
          <div><strong>{unreadCount}</strong><span>Unread</span></div>
        </div>
        <div className="notifications-v2-stat">
          <div className="notifications-v2-stat-icon muted"><Check size={17} /></div>
          <div><strong>{readCount}</strong><span>Read</span></div>
        </div>
      </section>

      {error && <div className="notifications-v2-error" role="alert">{error}</div>}

      <section className="notifications-v2-feed">
        <div className="notifications-v2-feed-header">
          <div>
            <span className="notifications-v2-label">ACTIVITY FEED</span>
            <h2>Recent updates</h2>
          </div>

          <div className="notifications-v2-filters">
            {(['all', 'unread', 'read'] as FilterType[]).map(item => (
              <button
                key={item}
                className={filter === item ? 'active' : ''}
                onClick={() => setFilter(item)}
                disabled={saving}
              >
                {item.charAt(0).toUpperCase() + item.slice(1)}
                <span>
                  {item === 'all' ? notifications.length : item === 'unread' ? unreadCount : readCount}
                </span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="notifications-v2-empty">
            <div className="notifications-v2-empty-icon"><Bell size={25} /></div>
            <strong>Loading your updates</strong>
            <p>Getting your latest workspace activity.</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="notifications-v2-empty">
            <div className="notifications-v2-empty-icon"><Inbox size={25} /></div>
            <strong>{filter === 'all' ? 'Your inbox is empty' : `No ${filter} notifications`}</strong>
            <p>
              {filter === 'all'
                ? 'New workspace activity will appear here.'
                : 'Try another filter to see your notifications.'}
            </p>
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')}>View all notifications</button>
            )}
          </div>
        ) : (
          <div className="notifications-v2-list">
            {filteredNotifications.map(item => (
              <article
                key={item.id}
                className={`notifications-v2-item ${item.is_read ? 'is-read' : 'is-unread'}`}
              >
                <div className={`notifications-v2-item-icon type-${item.type}`}>
                  {getIcon(item.type)}
                </div>

                <button
                  className="notifications-v2-item-body"
                  onClick={() => openNotification(item)}
                  disabled={saving}
                >
                  <div className="notifications-v2-item-meta">
                    <span>{getTypeLabel(item.type)}</span>
                    {!item.is_read && <span className="notifications-v2-new">NEW</span>}
                  </div>
                  <strong>{item.title}</strong>
                  <p>{item.message}</p>
                  <span className="notifications-v2-time">
                    <Clock3 size={12} />
                    {formatDate(item.created_at)}
                  </span>
                </button>

                <div className="notifications-v2-item-actions">
                  {!item.is_read && (
                    <button
                      onClick={() => markAsRead(item.id)}
                      disabled={saving}
                      aria-label="Mark as read"
                      title="Mark as read"
                    >
                      <Check size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(item.id)}
                    disabled={saving}
                    aria-label="Delete notification"
                    title="Delete notification"
                    className="delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="notifications-v2-feed-footer">
          Showing {filteredNotifications.length} of {notifications.length} notifications
        </div>
      </section>
    </main>
  )
}

export default Notifications
