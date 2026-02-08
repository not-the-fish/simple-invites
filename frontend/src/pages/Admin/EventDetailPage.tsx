import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { adminApi, setAuthToken } from '../../services/admin'
import type { Event } from '../../types/admin'

export const EventDetailPage = () => {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      setAuthToken(token)
    } else {
      navigate('/admin/login')
      return
    }

    if (eventId) {
      loadEvent()
    }
  }, [eventId, navigate])

  const loadEvent = async () => {
    try {
      const data = await adminApi.getEvent(Number(eventId))
      setEvent(data)
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('admin_token')
        navigate('/admin/login')
      } else {
        setError('Failed to load event')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return
    }

    try {
      await adminApi.deleteEvent(Number(eventId))
      navigate('/admin/dashboard')
    } catch (err: any) {
      setError('Failed to delete event')
    }
  }

  const copyInvitationLink = () => {
    if (event) {
      const link = `${window.location.origin}/rsvp/${event.invitation_token}`
      navigator.clipboard.writeText(link)
      alert('Invitation link copied to clipboard!')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading event...</p>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Event not found</p>
          <Link to="/admin/dashboard" className="text-purple-600 hover:text-purple-700">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link to="/admin/dashboard" className="text-purple-600 hover:text-purple-700">
              ← Back to Dashboard
            </Link>
            <div className="flex gap-2">
              <Link
                to={`/admin/events/${eventId}/edit`}
                className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
              >
                Edit
              </Link>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{event.title}</h1>

          {event.description && (
            <p className="text-gray-700 mb-6 whitespace-pre-wrap">{event.description}</p>
          )}

          <div className="space-y-4 mb-6">
            <div>
              <span className="font-medium text-gray-700">Date & Time:</span>
              <p className="text-gray-900">
                {new Date(event.date).toLocaleString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZoneName: 'short',
                })}
              </p>
            </div>

            {event.location && (
              <div>
                <span className="font-medium text-gray-700">Location:</span>
                <p className="text-gray-900">{event.location}</p>
              </div>
            )}

            <div>
              <span className="font-medium text-gray-700">Invitation Token:</span>
              <div className="flex items-center gap-2 mt-1">
                <code className="px-3 py-1 bg-gray-100 rounded text-sm font-mono">
                  {event.invitation_token}
                </code>
                <button
                  onClick={copyInvitationLink}
                  className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                >
                  Copy Link
                </button>
              </div>
            </div>

            {event.access_code && (
              <div>
                <span className="font-medium text-gray-700">Access Code:</span>
                <p className="text-gray-900 font-mono">{event.access_code}</p>
              </div>
            )}
          </div>

          <div className="border-t pt-6">
            <Link
              to={`/admin/events/${eventId}/rsvps`}
              className="inline-block px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-medium"
            >
              View RSVPs
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}


