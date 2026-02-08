import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { adminApi, setAuthToken } from '../../services/admin'
import { QuestionVisualization } from '../../components/Admin/QuestionVisualization'
import type { Survey } from '../../types/admin'
import type { QuestionResponse, SurveySubmission, QuestionResponseGroup } from '../../types/survey'

export const SurveyResultsPage = () => {
  const { surveyId } = useParams<{ surveyId: string }>()
  const navigate = useNavigate()
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [submissions, setSubmissions] = useState<SurveySubmission[]>([])
  const [responses, setResponses] = useState<QuestionResponse[]>([])
  const [responsesByQuestion, setResponsesByQuestion] = useState<QuestionResponseGroup[]>([])
  const [viewMode, setViewMode] = useState<'submissions' | 'responses' | 'byQuestion'>('submissions')
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
      loadData()
    }
  }, [surveyId, navigate])

  const loadData = async () => {
    try {
      const [surveyData, submissionsData, responsesData, responsesByQuestionData] = await Promise.all([
        adminApi.getSurvey(Number(surveyId)),
        adminApi.getSurveySubmissions(Number(surveyId)),
        adminApi.getSurveyResponses(Number(surveyId)),
        adminApi.getSurveyResponsesByQuestion(Number(surveyId)),
      ])
      setSurvey(surveyData)
      setSubmissions(submissionsData)
      setResponses(responsesData)
      setResponsesByQuestion(responsesByQuestionData)
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('admin_token')
        navigate('/admin/login')
      } else {
        setError('Failed to load survey responses')
      }
    } finally {
      setLoading(false)
    }
  }

  const formatAnswer = (answer: string | string[] | boolean | Record<string, string> | null): string => {
    if (answer === null || answer === undefined) {
      return 'No answer'
    }
    if (typeof answer === 'boolean') {
      return answer ? 'Yes' : 'No'
    }
    if (Array.isArray(answer)) {
      return answer.join(', ')
    }
    if (typeof answer === 'object' && !Array.isArray(answer)) {
      // Handle "other" format for multiple choice: { value: "other", other_text: "custom" }
      if ('value' in answer && (answer as any).value === 'other') {
        return `Other: ${(answer as any).other_text || ''}`
      }
      // Handle "other" format for checkbox: { values: ["option1", "other"], other_text: "custom" }
      if ('values' in answer && Array.isArray((answer as any).values)) {
        const values = (answer as any).values as string[]
        const otherText = (answer as any).other_text || ''
        const displayValues = values.map(v => v === 'other' ? `Other: ${otherText}` : v)
        return displayValues.join(', ')
      }
      // Handle matrix_single format: { "row": "column" }
      const entries = Object.entries(answer as Record<string, string>)
      if (entries.length === 0) {
        return 'No selections'
      }
      return entries.map(([row, column]) => `${row}: ${column}`).join('; ')
    }
    return String(answer)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading responses...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link to={`/admin/surveys/${surveyId}`} className="text-purple-600 hover:text-purple-700">
              ← Back to Survey
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-8 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {survey?.title || 'Survey Responses'}
              </h1>
              {survey && survey.questions && (
                <p className="text-gray-600 mb-2">
                  {survey.questions.length} {survey.questions.length === 1 ? 'question' : 'questions'}
                </p>
              )}
              <p className="text-sm text-gray-500">
                {viewMode === 'submissions' ? (
                  <>Total Submissions: <span className="font-medium">{submissions.length}</span></>
                ) : viewMode === 'byQuestion' ? (
                  <>Total Questions: <span className="font-medium">{responsesByQuestion.length}</span></>
                ) : (
                  <>Total Question Responses: <span className="font-medium">{responses.length}</span></>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('submissions')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'submissions'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                By Submission
              </button>
              <button
                onClick={() => setViewMode('byQuestion')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'byQuestion'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                By Question
              </button>
              <button
                onClick={() => setViewMode('responses')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'responses'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Responses
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'submissions' ? (
          submissions.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600">No submissions yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {submissions.map((submission) => (
                <div key={submission.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start mb-4 pb-4 border-b">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Submission #{submission.id}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Submitted: {new Date(submission.submitted_at).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {submission.rsvp_response && survey?.event_id && (
                      <Link
                        to={`/admin/events/${survey.event_id}/rsvps`}
                        className="text-purple-600 hover:text-purple-700 text-sm"
                      >
                        RSVP: {submission.identity || 'Anonymous'} - {submission.rsvp_response}
                      </Link>
                    )}
                  </div>
                  <div className="space-y-3">
                    {submission.question_responses.map((qr) => {
                      const question = survey?.questions?.find(q => q.id === qr.question_id)
                      return (
                        <div key={qr.id} className="flex gap-4">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700 mb-1">
                              {question ? question.question_text : `Question #${qr.question_id}`}
                            </p>
                            <p className="text-sm text-gray-900">
                              {formatAnswer(qr.answer)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : viewMode === 'byQuestion' ? (
          responsesByQuestion.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600">No responses yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {responsesByQuestion.map((group) => {
                return (
                  <div key={group.question_id} className="bg-white rounded-lg shadow p-6">
                    <div className="mb-4 pb-4 border-b">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {group.question_text}
                      </h3>
                      <div className="flex gap-4 text-sm text-gray-500">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                          {group.question_type}
                        </span>
                        <span>
                          {group.responses.length} {group.responses.length === 1 ? 'response' : 'responses'}
                        </span>
                      </div>
                    </div>
                    {group.responses.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No responses yet for this question.</p>
                    ) : (
                      <>
                        {/* Show visualization for supported question types */}
                        {(group.question_type === 'yes_no' || 
                          group.question_type === 'multiple_choice' || 
                          group.question_type === 'checkbox' ||
                          group.question_type === 'matrix' ||
                          group.question_type === 'matrix_single') && (
                          <QuestionVisualization 
                            group={group} 
                            questionType={group.question_type}
                          />
                        )}
                        
                        {/* Show individual responses */}
                        <div className="mt-6 space-y-3">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Individual Responses</h4>
                          {group.responses.map((response) => {
                            const submission = submissions.find(s => s.id === response.submission_id)
                            return (
                              <div key={response.id} className="flex gap-4 items-start p-3 bg-gray-50 rounded-lg">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs text-gray-500">
                                      Response #{response.id}
                                    </span>
                                    {submission && (
                                      <>
                                        <span className="text-gray-300">•</span>
                                        <span className="text-xs text-gray-500">
                                          Submission #{response.submission_id}
                                        </span>
                                        <span className="text-gray-300">•</span>
                                        <span className="text-xs text-gray-500">
                                          {new Date(submission.submitted_at).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                          })}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {formatAnswer(response.answer)}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )
        ) : (
          responses.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600">No responses yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Response ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Submission ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Question
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Answer
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {responses.map((response) => {
                      const question = survey?.questions?.find(q => q.id === response.question_id)
                      const submission = submissions.find(s => s.id === response.submission_id)
                      return (
                        <tr key={response.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            #{response.id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            #{response.submission_id}
                            {submission && (
                              <span className="block text-xs text-gray-400 mt-1">
                                {new Date(submission.submitted_at).toLocaleDateString()}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            <div className="max-w-xs">
                              {question ? (
                                <span className="line-clamp-2">{question.question_text}</span>
                              ) : (
                                <span className="text-gray-400">Question #{response.question_id}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="max-w-md">
                              <span className="font-medium">{formatAnswer(response.answer)}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </main>
    </div>
  )
}

