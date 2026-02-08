import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { adminApi, setAuthToken } from '../../services/admin'
import type { RSVPSubmission } from '../../types/rsvp'

export const RSVPsPage = () => {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const [rsvps, setRsvps] = useState<RSVPSubmission[]>([])
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
      loadRSVPs()
    }
  }, [eventId, navigate])

  const loadRSVPs = async () => {
    try {
      const data = await adminApi.getEventRSVPs(Number(eventId))
      setRsvps(data)
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('admin_token')
        navigate('/admin/login')
      } else {
        setError('Failed to load RSVPs')
      }
    } finally {
      setLoading(false)
    }
  }

  const getResponseColor = (response: string) => {
    switch (response) {
      case 'yes':
        return 'bg-green-100 text-green-800'
      case 'maybe':
        return 'bg-yellow-100 text-yellow-800'
      case 'no':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const responseCounts = {
    yes: rsvps.filter((r) => r.response === 'yes').length,
    maybe: rsvps.filter((r) => r.response === 'maybe').length,
    no: rsvps.filter((r) => r.response === 'no').length,
  }

  const handleDelete = async (rsvpId: number, identity: string) => {
    if (!confirm(`Are you sure you want to delete the RSVP from "${identity}"?`)) {
      return
    }

    try {
      await adminApi.deleteRSVP(Number(eventId), rsvpId)
      setRsvps(rsvps.filter((r) => r.id !== rsvpId))
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('admin_token')
        navigate('/admin/login')
      } else {
        setError('Failed to delete RSVP')
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading RSVPs...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to="/admin/dashboard" className="text-purple-600 hover:text-purple-700">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">RSVPs</h1>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Total RSVPs</div>
              <div className="text-2xl font-bold text-gray-900">{rsvps.length}</div>
            </div>
            <div className="bg-green-50 rounded-lg shadow p-4">
              <div className="text-sm text-green-600">Yes</div>
              <div className="text-2xl font-bold text-green-900">{responseCounts.yes}</div>
            </div>
            <div className="bg-yellow-50 rounded-lg shadow p-4">
              <div className="text-sm text-yellow-600">Maybe</div>
              <div className="text-2xl font-bold text-yellow-900">{responseCounts.maybe}</div>
            </div>
          </div>
        </div>

        {rsvps.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">No RSVPs yet for this event.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Identity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Response
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rsvps.map((rsvp) => (
                  <tr key={rsvp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {rsvp.identity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getResponseColor(
                          rsvp.response
                        )}`}
                      >
                        {rsvp.response}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {rsvp.email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {rsvp.phone || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(rsvp.submitted_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => handleDelete(rsvp.id, rsvp.identity)}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}


