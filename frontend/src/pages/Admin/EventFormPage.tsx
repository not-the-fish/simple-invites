import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { adminApi, setAuthToken } from '../../services/admin'
import type { EventCreate, EventUpdate, Survey } from '../../types/admin'
import { getUserTimezone, getTimezoneAbbreviation } from '../../utils/timezone'

export const EventFormPage = () => {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const isEdit = !!eventId

  const [formData, setFormData] = useState<EventCreate>({
    title: '',
    description: '',
    date: '',
    location: '',
    access_code: '',
    show_rsvp_list: false,
    survey_id: null,
    survey_description: null,
    survey_questions: [],
  })
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [surveyMode, setSurveyMode] = useState<'existing' | 'create' | 'none'>('none')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      setAuthToken(token)
    } else {
      navigate('/admin/login')
      return
    }

    loadSurveys()
    if (isEdit && eventId) {
      loadEvent()
    }
  }, [eventId, isEdit, navigate])

  const loadSurveys = async () => {
    try {
      const surveysData = await adminApi.listSurveys()
      setSurveys(surveysData)
    } catch (err: any) {
      console.error('Failed to load surveys:', err)
    }
  }

  const loadEvent = async () => {
    try {
      const event = await adminApi.getEvent(Number(eventId))
      // Convert ISO datetime (UTC) to datetime-local format (YYYY-MM-DDTHH:mm)
      // The datetime-local input expects local time, so we need to convert from UTC to local
      const date = new Date(event.date)
      // Get local date components
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const localDate = `${year}-${month}-${day}T${hours}:${minutes}`
      
      setFormData({
        title: event.title,
        description: event.description || '',
        date: localDate,
        location: event.location || '',
        access_code: event.access_code || '',
        show_rsvp_list: event.show_rsvp_list || false,
        survey_id: event.survey_id || null,
        survey_description: null,
        survey_questions: [],
      })
      setSurveyMode(event.survey_id ? 'existing' : 'none')
    } catch (err: any) {
      setError('Failed to load event')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validate survey selection
    if (surveyMode === 'existing' && !formData.survey_id) {
      setError('Please select a survey to link')
      setLoading(false)
      return
    }

    try {
      // Convert datetime-local format to ISO string (UTC)
      // datetime-local gives us a string like "2026-01-04T18:00" (local time, no timezone)
      // We need to interpret this as local time and convert to UTC for storage
      const localDateString = formData.date // e.g., "2026-01-04T18:00"
      // Create a Date object treating the input as local time
      // new Date() with a datetime-local string interprets it as local time
      const localDate = new Date(localDateString)
      // Convert to ISO string (UTC) for storage
      const dateISO = localDate.toISOString()
      
      const submitData: EventCreate | EventUpdate = {
        ...formData,
        date: dateISO,
        description: formData.description || null,
        location: formData.location || null,
        access_code: formData.access_code || null,
        // Only include survey fields based on mode
        survey_id: surveyMode === 'existing' ? formData.survey_id : null,
        survey_description: surveyMode === 'create' ? formData.survey_description : null,
        survey_questions: surveyMode === 'create' ? (formData.survey_questions || []) : [],
      }

      if (isEdit && eventId) {
        await adminApi.updateEvent(Number(eventId), submitData)
      } else {
        const createdEvent = await adminApi.createEvent(submitData)
        // If we created a new survey, navigate directly to edit it
        if (surveyMode === 'create') {
          navigate(`/admin/surveys/${createdEvent.survey_id}/edit`)
          return
        }
      }
      navigate('/admin/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save event')
    } finally {
      setLoading(false)
    }
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

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            {isEdit ? 'Edit Event' : 'Create New Event'}
          </h1>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={8}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none font-mono text-sm"
                placeholder={`Enter event description with Markdown formatting:

**Bold text** or __bold text__
*Italic text* or _italic text_
~~Strikethrough~~

# Heading 1
## Heading 2
### Heading 3

- Bullet list item
- Another item

1. Numbered list item
2. Another numbered item

[Link text](https://example.com)

---

Line breaks are preserved`}
              />
              <div className="mt-2 text-xs text-gray-500 space-y-1">
                <p><strong>Formatting guide:</strong></p>
                <p>**bold**, *italic*, ~~strikethrough~~, # headings, - lists, [links](url)</p>
                <p>Line breaks are preserved. Empty lines create paragraphs.</p>
              </div>
            </div>

            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                Date & Time *
              </label>
              <input
                id="date"
                type="datetime-local"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                Timezone: {getTimezoneAbbreviation()} ({getUserTimezone()})
              </p>
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <input
                id="location"
                type="text"
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label htmlFor="access_code" className="block text-sm font-medium text-gray-700 mb-2">
                Access Code (optional)
              </label>
              <input
                id="access_code"
                type="text"
                value={formData.access_code || ''}
                onChange={(e) => setFormData({ ...formData, access_code: e.target.value })}
                placeholder="Leave empty for public event"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
              <p className="mt-1 text-sm text-gray-500">
                If set, attendees will need this code to RSVP
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <label htmlFor="show_rsvp_list" className="text-sm font-medium text-gray-700">
                  Show Guest List
                </label>
                <p className="text-sm text-gray-500">
                  Display names of attendees on the public RSVP page
                </p>
              </div>
              <button
                type="button"
                id="show_rsvp_list"
                onClick={() => setFormData({ ...formData, show_rsvp_list: !formData.show_rsvp_list })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                  formData.show_rsvp_list ? 'bg-purple-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    formData.show_rsvp_list ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Survey Section */}
            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">RSVP Survey</h2>
              <p className="text-sm text-gray-600 mb-4">
                Events require a survey for RSVP collection. You can link an existing survey or create a new one.
              </p>
              
              <div className="space-y-4">
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="surveyMode"
                      value="none"
                      checked={surveyMode === 'none'}
                      onChange={() => setSurveyMode('none')}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Create default empty survey</span>
                  </label>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="surveyMode"
                      value="existing"
                      checked={surveyMode === 'existing'}
                      onChange={() => setSurveyMode('existing')}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Link to existing survey</span>
                  </label>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="surveyMode"
                      value="create"
                      checked={surveyMode === 'create'}
                      onChange={() => setSurveyMode('create')}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Create new survey with questions</span>
                  </label>
                </div>
              </div>

              {surveyMode === 'existing' && (
                <div className="mt-4">
                  <label htmlFor="survey_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Select Survey
                  </label>
                  <select
                    id="survey_id"
                    value={formData.survey_id || ''}
                    onChange={(e) => setFormData({ ...formData, survey_id: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  >
                    <option value="">Select a survey...</option>
                    {surveys.map((survey) => (
                      <option key={survey.id} value={survey.id}>
                        {survey.title} {survey.event_id ? '(already linked to event)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {surveyMode === 'create' && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="survey_description" className="block text-sm font-medium text-gray-700 mb-2">
                      Survey Description
                    </label>
                    <textarea
                      id="survey_description"
                      value={formData.survey_description || ''}
                      onChange={(e) => setFormData({ ...formData, survey_description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      placeholder="Optional description for the survey"
                    />
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> You can add questions to this survey after creating the event, or create a survey separately and link it to the event.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <Link
                to="/admin/dashboard"
                className="flex-1 px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-center font-medium"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : isEdit ? 'Update Event' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

