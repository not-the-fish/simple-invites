import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import { adminApi, setAuthToken } from '../../services/admin'
import { getErrorResponse } from '../../services/api'
import type { Event, EventCreate, EventUpdate, QuestionCreate, Survey } from '../../types/admin'
import { getUserTimezone, getTimezoneAbbreviation } from '../../utils/timezone'

function eventToDatetimeLocal(dateString: string): string {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function mapQuestionToCreate(q: { question_type: string; question_text: string; options?: string[] | Record<string, string[]> | null; allow_other: boolean; required: boolean; order: number }): QuestionCreate {
  return {
    question_type: q.question_type as QuestionCreate['question_type'],
    question_text: q.question_text,
    options: q.options ?? undefined,
    allow_other: q.allow_other,
    required: q.required,
    order: q.order,
  }
}

export const EventFormPage = () => {
  const { eventId } = useParams<{ eventId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isEdit = !!eventId
  const cloneFrom = searchParams.get('cloneFrom')

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

  // Clone-from-event state
  const [cloneSourceEvent, setCloneSourceEvent] = useState<Event | null>(null)
  const [cloneSourceSurvey, setCloneSourceSurvey] = useState<Survey | null>(null)
  const [cloneLoading, setCloneLoading] = useState(false)
  const [cloneError, setCloneError] = useState<string | null>(null)
  const [cloneSurvey, setCloneSurvey] = useState<boolean | null>(null)
  const [editSurveyAfterCreate, setEditSurveyAfterCreate] = useState(false)
  const cloneEventPrefilledRef = useRef(false)

  const loadSurveys = useCallback(async () => {
    try {
      const surveysData = await adminApi.listSurveys()
      setSurveys(surveysData)
    } catch (err: unknown) {
      console.error('Failed to load surveys:', err)
    }
  }, [])

  const loadEvent = useCallback(async () => {
    if (!eventId) return
    try {
      const event = await adminApi.getEvent(Number(eventId))
      const date = new Date(event.date)
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
    } catch (err: unknown) {
      setError('Failed to load event')
    }
  }, [eventId])

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      setAuthToken(token)
      loadSurveys()
      if (isEdit && eventId) loadEvent()
    } else {
      navigate('/admin/login')
    }
  }, [eventId, isEdit, navigate, loadSurveys, loadEvent])

  // Load clone source when on new-event with cloneFrom
  useEffect(() => {
    if (!cloneFrom || isEdit) return
    let cancelled = false
    setCloneLoading(true)
    setCloneError(null)
    setCloneSourceEvent(null)
    setCloneSourceSurvey(null)
    setCloneSurvey(null)
    cloneEventPrefilledRef.current = false

    const loadCloneSource = async () => {
      try {
        const event = await adminApi.getEvent(Number(cloneFrom))
        if (cancelled) return
        setCloneSourceEvent(event)
        if (event.survey_id) {
          const survey = await adminApi.getSurvey(event.survey_id)
          if (cancelled) return
          setCloneSourceSurvey(survey)
          if (!survey.questions?.length) setCloneSurvey(false)
        }
      } catch (err: unknown) {
        if (cancelled) return
        const { status } = getErrorResponse(err)
        if (status === 404) {
          setCloneError('Source event not found')
        } else {
          setCloneError('Failed to load event to clone')
        }
      } finally {
        if (!cancelled) setCloneLoading(false)
      }
    }
    loadCloneSource()
    return () => { cancelled = true }
  }, [cloneFrom, isEdit])

  // Prefill form from clone source (event fields once; survey when clone choices resolved)
  useEffect(() => {
    if (!cloneSourceEvent || isEdit) return

    if (!cloneEventPrefilledRef.current) {
      cloneEventPrefilledRef.current = true
      setFormData((prev) => ({
        ...prev,
        title: cloneSourceEvent.title,
        description: cloneSourceEvent.description || '',
        date: eventToDatetimeLocal(cloneSourceEvent.date),
        location: cloneSourceEvent.location || '',
        access_code: '', // do not copy hash
        show_rsvp_list: cloneSourceEvent.show_rsvp_list ?? false,
      }))
    }

    const hasSurveyQuestions = cloneSourceSurvey && cloneSourceSurvey.questions && cloneSourceSurvey.questions.length > 0
    if (!hasSurveyQuestions) {
      setSurveyMode('none')
      return
    }
    if (cloneSurvey === false) {
      setSurveyMode('none')
      setFormData((prev) => ({ ...prev, survey_description: null, survey_questions: [] }))
      return
    }
    if (cloneSurvey === true && cloneSourceSurvey) {
      setSurveyMode('create')
      setFormData((prev) => ({
        ...prev,
        survey_description: cloneSourceSurvey.description ?? null,
        survey_questions: cloneSourceSurvey.questions!.map(mapQuestionToCreate),
      }))
    }
  }, [cloneSourceEvent, cloneSourceSurvey, cloneSurvey, isEdit])

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
        // If we created a new survey: when cloning, only go to edit if user chose "edit after"; otherwise always go to edit
        const goToSurveyEdit = surveyMode === 'create' && (cloneFrom ? editSurveyAfterCreate : true)
        if (goToSurveyEdit) {
          navigate(`/admin/surveys/${createdEvent.survey_id}/edit`)
          return
        }
      }
      navigate('/admin/dashboard')
    } catch (err: unknown) {
      const { detail } = getErrorResponse(err)
      setError(detail || 'Failed to save event')
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
            {isEdit ? 'Edit Event' : cloneFrom ? 'Clone Event' : 'Create New Event'}
          </h1>

          {cloneLoading && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-600">Loading event to clone...</p>
            </div>
          )}

          {cloneError && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">{cloneError}</p>
              <Link to="/admin/events/new" className="mt-2 inline-block text-sm text-amber-700 underline">Start with empty form</Link>
            </div>
          )}

          {cloneSourceEvent && cloneSourceSurvey && cloneSourceSurvey.questions && cloneSourceSurvey.questions.length > 0 && cloneSurvey === null && !cloneLoading && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
              <p className="text-sm text-gray-800">
                Cloning from: <strong>{cloneSourceEvent.title}</strong>. This event has a survey with {cloneSourceSurvey.questions.length} question{cloneSourceSurvey.questions.length === 1 ? '' : 's'}. Do you want to clone the survey?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCloneSurvey(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setCloneSurvey(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm font-medium"
                >
                  No
                </button>
              </div>
            </div>
          )}

          {cloneSurvey === true && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
              <p className="text-sm text-gray-800">Edit the cloned survey after creating the event?</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditSurveyAfterCreate(true)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${editSurveyAfterCreate ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setEditSurveyAfterCreate(false)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${!editSurveyAfterCreate ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                >
                  No
                </button>
              </div>
            </div>
          )}

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
                disabled={loading || cloneLoading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : cloneLoading ? 'Loading...' : isEdit ? 'Update Event' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

