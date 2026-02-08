import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { eventsApi } from '../services/events'
import { RSVPFlow } from '../components/RSVP/RSVPFlow'
import ReactMarkdown from 'react-markdown'
import { getErrorMessage } from '../utils/retry'
import { formatDateWithTimezone } from '../utils/timezone'

type Attendee = {
  name: string
  num_attendees: number
}

type RSVPStats = {
  event_title: string
  event_description: string | null
  event_date: string
  event_location: string | null
  total_rsvps: number
  yes_count: number
  yes_attendees: number
  no_count: number
  maybe_count: number
  maybe_attendees: number
  has_survey: boolean
  show_rsvp_list: boolean
  attendees?: {
    yes: Attendee[]
    maybe: Attendee[]
  }
}

type ViewMode = 'landing' | 'rsvp'

export const RSVPPage = () => {
  const { invitationToken } = useParams<{ invitationToken: string }>()
  const [searchParams] = useSearchParams()
  const accessCodeParam = searchParams.get('code')

  const [viewMode, setViewMode] = useState<ViewMode>('landing')
  const [stats, setStats] = useState<RSVPStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check if we're coming from a direct link to start RSVP
    const shouldStartRSVP = searchParams.get('start') === 'true'
    if (shouldStartRSVP) {
      setViewMode('rsvp')
      setLoading(false)
      return
    }

    loadStats()
  }, [invitationToken, searchParams])

  const loadStats = async () => {
    if (!invitationToken) return

    try {
      setLoading(true)
      const response = await eventsApi.getRSVPStats(invitationToken, accessCodeParam || undefined)
      setStats(response)
    } catch (err: any) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleStartRSVP = () => {
    setViewMode('rsvp')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading event...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-800 mb-2">Unable to Load Event</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <Link
              to="/"
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (viewMode === 'rsvp') {
    return <RSVPFlow />
  }

  // Landing page
  if (!stats) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{stats.event_title}</h1>
          {stats.event_description && (
            <div className="prose prose-gray max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ node, ...props }) => <h1 {...props} className="text-2xl font-bold text-gray-900 mt-6 mb-4" />,
                  h2: ({ node, ...props }) => <h2 {...props} className="text-xl font-bold text-gray-900 mt-5 mb-3" />,
                  h3: ({ node, ...props }) => <h3 {...props} className="text-lg font-semibold text-gray-900 mt-4 mb-2" />,
                  p: ({ node, ...props }) => <p {...props} className="text-gray-700 mb-4 leading-relaxed" />,
                  ul: ({ node, ...props }) => <ul {...props} className="list-disc list-inside mb-4 space-y-2 text-gray-700" />,
                  ol: ({ node, ...props }) => <ol {...props} className="list-decimal list-inside mb-4 space-y-2 text-gray-700" />,
                  li: ({ node, ...props }) => <li {...props} className="ml-4" />,
                  a: ({ node, ...props }) => (
                    <a {...props} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline" />
                  ),
                }}
              >
                {stats.event_description}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Event Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Event Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Date & Time</p>
                <p className="text-gray-900">
                  {formatDateWithTimezone(stats.event_date)}
                </p>
              </div>
              {stats.event_location && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Location</p>
                  <p className="text-gray-900">{stats.event_location}</p>
                </div>
              )}
            </div>
          </div>

          {/* RSVP Statistics */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">RSVP Status</h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{stats.yes_attendees}</div>
                <div className="text-sm text-gray-600">Attending</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">{stats.maybe_attendees}</div>
                <div className="text-sm text-gray-600">Maybe</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{stats.no_count}</div>
                <div className="text-sm text-gray-600">Can't Make It</div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">{stats.total_rsvps}</div>
              <div className="text-sm text-gray-600">Total RSVPs</div>
            </div>
          </div>

          {/* Guest List (when enabled) */}
          {stats.show_rsvp_list && stats.attendees && (
            <div className="bg-white rounded-lg shadow p-6 md:col-span-2">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Who's Coming</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Attending */}
                {stats.attendees.yes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-green-700 mb-3 flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                      Attending ({stats.yes_attendees} {stats.yes_attendees === 1 ? 'person' : 'people'})
                    </h3>
                    <ul className="space-y-2">
                      {stats.attendees.yes.map((attendee, idx) => (
                        <li key={idx} className="text-gray-700 flex items-center justify-between">
                          <span>{attendee.name}</span>
                          {attendee.num_attendees > 1 && (
                            <span className="text-sm text-gray-500">+{attendee.num_attendees - 1} guest{attendee.num_attendees > 2 ? 's' : ''}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Maybe */}
                {stats.attendees.maybe.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-yellow-700 mb-3 flex items-center">
                      <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                      Maybe ({stats.maybe_attendees} {stats.maybe_attendees === 1 ? 'person' : 'people'})
                    </h3>
                    <ul className="space-y-2">
                      {stats.attendees.maybe.map((attendee, idx) => (
                        <li key={idx} className="text-gray-700 flex items-center justify-between">
                          <span>{attendee.name}</span>
                          {attendee.num_attendees > 1 && (
                            <span className="text-sm text-gray-500">+{attendee.num_attendees - 1} guest{attendee.num_attendees > 2 ? 's' : ''}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RSVP Action */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Ready to RSVP?
            </h3>
            <p className="text-gray-600 mb-6">
              Let us know if you'll be joining us and answer a few quick questions.
            </p>
            <button
              onClick={handleStartRSVP}
              className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-lg font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg hover:shadow-xl"
            >
              RSVP
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

