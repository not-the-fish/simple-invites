import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { adminApi, setAuthToken } from '../../services/admin'
import type { Event, Survey } from '../../types/admin'

export const Dashboard = () => {
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check for auth token
    const token = localStorage.getItem('admin_token')
    if (token) {
      setAuthToken(token)
    } else {
      navigate('/admin/login')
      return
    }

    loadData()
  }, [navigate])

  const loadData = async () => {
    try {
      const [eventsData, surveysData] = await Promise.all([
        adminApi.listEvents(),
        adminApi.listSurveys(),
      ])
      setEvents(eventsData)
      setSurveys(surveysData)
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('admin_token')
        navigate('/admin/login')
      } else {
        setError('Failed to load data')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    setAuthToken(null)
    navigate('/admin/login')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Events Section */}
        <div className="mb-8">
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Events</h2>
            <Link
              to="/admin/events/new"
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-medium"
            >
              + Create Event
            </Link>
          </div>

          {events.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600 mb-4">No events yet.</p>
              <Link
                to="/admin/events/new"
                className="inline-block px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-medium"
              >
                Create your first event
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <div key={event.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{event.title}</h3>
                    {event.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">{event.description}</p>
                    )}
                    <div className="space-y-2 mb-4">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Date:</span> {formatDate(event.date)}
                      </p>
                      {event.location && (
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Location:</span> {event.location}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Link
                        to={`/admin/events/${event.id}`}
                        className="flex-1 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-center text-sm font-medium"
                      >
                        View Details
                      </Link>
                      <Link
                        to={`/admin/events/${event.id}/rsvps`}
                        className="flex-1 px-4 py-2 bg-pink-100 text-pink-700 rounded-lg hover:bg-pink-200 transition-colors text-center text-sm font-medium"
                      >
                        View RSVPs
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Surveys Section */}
        <div>
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Surveys</h2>
            <Link
              to="/admin/surveys/new"
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-medium"
            >
              + Create Survey
            </Link>
          </div>

          {surveys.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600 mb-4">No surveys yet.</p>
              <Link
                to="/admin/surveys/new"
                className="inline-block px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-medium"
              >
                Create your first survey
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {surveys.map((survey) => (
                <div key={survey.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{survey.title}</h3>
                    {survey.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">{survey.description}</p>
                    )}
                    <div className="space-y-2 mb-4">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Questions:</span> {survey.questions?.length || 0}
                      </p>
                      {survey.questions && survey.questions.length > 0 && (
                        <p className="text-sm text-gray-600 line-clamp-1">
                          {survey.questions[0].question_text}
                        </p>
                      )}
                      {survey.event_id && (
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Event ID:</span> {survey.event_id}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Link
                        to={`/admin/surveys/${survey.id}`}
                        className="flex-1 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-center text-sm font-medium"
                      >
                        View Details
                      </Link>
                      <Link
                        to={`/admin/surveys/${survey.id}/responses`}
                        className="flex-1 px-4 py-2 bg-pink-100 text-pink-700 rounded-lg hover:bg-pink-200 transition-colors text-center text-sm font-medium"
                      >
                        View Responses
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

