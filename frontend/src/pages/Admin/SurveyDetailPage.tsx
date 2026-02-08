import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { adminApi, setAuthToken } from '../../services/admin'
import type { Survey } from '../../types/admin'

export const SurveyDetailPage = () => {
  const { surveyId } = useParams<{ surveyId: string }>()
  const navigate = useNavigate()
  const [survey, setSurvey] = useState<Survey | null>(null)
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

    if (surveyId) {
      loadSurvey()
    }
  }, [surveyId, navigate])

  const loadSurvey = async () => {
    try {
      const data = await adminApi.getSurvey(Number(surveyId))
      setSurvey(data)
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('admin_token')
        navigate('/admin/login')
      } else {
        setError('Failed to load survey')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this survey? This action cannot be undone.')) {
      return
    }

    try {
      await adminApi.deleteSurvey(Number(surveyId))
      navigate('/admin/dashboard')
    } catch (err: any) {
      setError('Failed to delete survey')
    }
  }

  const copySurveyLink = () => {
    if (survey) {
      const link = `${window.location.origin}/survey/${survey.survey_token}`
      navigator.clipboard.writeText(link)
      alert('Survey link copied to clipboard!')
    }
  }

  const getQuestionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      text: 'Text Input',
      multiple_choice: 'Multiple Choice',
      checkbox: 'Checkbox (Multiple Selection)',
      yes_no: 'Yes/No',
      date_time: 'Date & Time',
    }
    return labels[type] || type
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading survey...</p>
        </div>
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Survey not found</p>
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
                to={`/admin/surveys/${surveyId}/edit`}
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
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{survey.title}</h1>

          {survey.description && (
            <p className="text-gray-700 mb-6 whitespace-pre-wrap">{survey.description}</p>
          )}

          <div className="space-y-6 mb-6">
            <div>
              <span className="font-medium text-gray-700">Number of Questions:</span>
              <p className="text-gray-900">{survey.questions?.length || 0}</p>
            </div>

            {survey.questions && survey.questions.length > 0 && (
              <div>
                <span className="font-medium text-gray-700 mb-2 block">Questions:</span>
                <div className="space-y-4 mt-2">
                  {survey.questions
                    .sort((a, b) => a.order - b.order)
                    .map((question, idx) => (
                      <div key={question.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-medium text-gray-600">Question {idx + 1}</span>
                          <span className="text-xs text-gray-500">{getQuestionTypeLabel(question.question_type)}</span>
                        </div>
                        <p className="text-gray-900 font-medium mb-2">{question.question_text}</p>
                        {question.options && Array.isArray(question.options) && question.options.length > 0 && (
                          <div className="mt-2">
                            <span className="text-xs text-gray-600">Options: </span>
                            <span className="text-xs text-gray-700">{question.options.join(', ')}</span>
                          </div>
                        )}
                        {question.options && !Array.isArray(question.options) && 'rows' in question.options && (
                          <div className="mt-2">
                            <span className="text-xs text-gray-600">Matrix: </span>
                            <span className="text-xs text-gray-700">{question.options.rows.length} rows × {question.options.columns.length} columns</span>
                          </div>
                        )}
                        <div className="mt-2 text-xs text-gray-600">
                          {question.required ? 'Required' : 'Optional'}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div>
              <span className="font-medium text-gray-700">Survey Token:</span>
              <div className="flex items-center gap-2 mt-1">
                <code className="px-3 py-1 bg-gray-100 rounded text-sm font-mono">
                  {survey.survey_token}
                </code>
                <button
                  onClick={copySurveyLink}
                  className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                >
                  Copy Link
                </button>
              </div>
            </div>

            {survey.event_id && (
              <div>
                <span className="font-medium text-gray-700">Associated Event ID:</span>
                <p className="text-gray-900">{survey.event_id}</p>
              </div>
            )}

            <div>
              <span className="font-medium text-gray-700">Created:</span>
              <p className="text-gray-900">
                {new Date(survey.created_at).toLocaleString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          <div className="border-t pt-6 flex gap-4">
            <Link
              to={`/admin/surveys/${surveyId}/responses`}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-medium"
            >
              View Responses
            </Link>
            <a
              href={`/survey/${survey.survey_token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Preview Survey
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}

