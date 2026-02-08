import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { adminApi, setAuthToken } from '../../services/admin'
import type { SurveyCreate, QuestionType, Event, QuestionCreate } from '../../types/admin'

export const SurveyFormPage = () => {
  const { surveyId } = useParams<{ surveyId: string }>()
  const navigate = useNavigate()
  const isEdit = !!surveyId

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventId, setEventId] = useState<number | null>(null)
  const [questions, setQuestions] = useState<QuestionCreate[]>([])
  const [existingQuestionIds, setExistingQuestionIds] = useState<number[]>([]) // Track IDs of existing questions
  const [optionsText, setOptionsText] = useState<Record<number, string>>({}) // Store raw text for options
  const [matrixConfig, setMatrixConfig] = useState<Record<number, { rows: string, columns: string }>>({}) // Store matrix rows/columns separately
  const [events, setEvents] = useState<Event[]>([])
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

    loadEvents()

    if (isEdit && surveyId) {
      loadSurvey()
    } else {
      // Start with one empty question for new surveys
      setQuestions([{
        question_type: 'text',
        question_text: '',
        options: null,
        allow_other: false,
        required: false,
        order: 1,
      }])
    }
  }, [surveyId, isEdit, navigate])

  const loadEvents = async () => {
    try {
      const data = await adminApi.listEvents()
      setEvents(data)
    } catch (err: any) {
      console.error('Failed to load events:', err)
    }
  }

  const loadSurvey = async () => {
    try {
      setLoading(true)
      const survey = await adminApi.getSurvey(Number(surveyId))
      setTitle(survey.title)
      setDescription(survey.description || '')
      setEventId(survey.event_id)
      // Load questions separately
      const surveyQuestions = await adminApi.getSurveyQuestions(Number(surveyId))
      const loadedQuestions = surveyQuestions.map(q => ({
        question_type: q.question_type,
        question_text: q.question_text,
        options: q.options,
        allow_other: q.allow_other || false,
        required: q.required,
        order: q.order,
      }))
      setQuestions(loadedQuestions)
      // Store existing question IDs for tracking
      setExistingQuestionIds(surveyQuestions.map(q => q.id))

      // Initialize options text for each question
      const initialOptionsText: Record<number, string> = {}
      const initialMatrixConfig: Record<number, { rows: string, columns: string }> = {}
      loadedQuestions.forEach((q, idx) => {
        if (q.question_type === 'matrix' && q.options) {
          // Parse matrix config
          try {
            const config = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
            if (config.rows && config.columns) {
              initialMatrixConfig[idx] = {
                rows: Array.isArray(config.rows) ? config.rows.join('\n') : config.rows,
                columns: Array.isArray(config.columns) ? config.columns.join('\n') : config.columns
              }
            }
          } catch {
            // Fallback - try to parse as array or use defaults
            if (Array.isArray(q.options)) {
              initialMatrixConfig[idx] = {
                rows: 'First\nSecond\nThird\nFourth',
                columns: q.options.join('\n')
              }
            } else {
              initialMatrixConfig[idx] = {
                rows: 'First\nSecond\nThird\nFourth',
                columns: 'Monday\nTuesday\nWednesday\nThursday\nFriday\nSaturday\nSunday'
              }
            }
          }
        } else if (q.options && Array.isArray(q.options) && q.options.length > 0) {
          initialOptionsText[idx] = q.options.join('\n')
        }
      })
      setOptionsText(initialOptionsText)
      setMatrixConfig(initialMatrixConfig)
      setLoading(false)
    } catch (err: any) {
      console.error('Failed to load survey:', err)
      setError(`Failed to load survey: ${err.response?.data?.detail || err.message}`)
      setLoading(false)
    }
  }

  const addQuestion = () => {
    const newOrder = questions.length > 0 
      ? Math.max(...questions.map(q => q.order || 0)) + 1 
      : 1
    const newIndex = questions.length
    setQuestions([...questions, {
      question_type: 'text',
      question_text: '',
      options: null,
      allow_other: false,
      required: false,
      order: newOrder,
    }])
    // New questions don't have IDs yet (will be created on save)
    setExistingQuestionIds([...existingQuestionIds, 0]) // 0 indicates new question
    // Initialize empty options text for new question
    setOptionsText({ ...optionsText, [newIndex]: '' })
    setMatrixConfig({ ...matrixConfig, [newIndex]: { rows: '', columns: '' } })
  }

  const removeQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index)
    setQuestions(updated)
    // Also remove from existingQuestionIds if it was an existing question
    if (index < existingQuestionIds.length) {
      setExistingQuestionIds(existingQuestionIds.filter((_, i) => i !== index))
    }
  }

  const updateQuestion = (index: number, updates: Partial<QuestionCreate>) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], ...updates }
    setQuestions(updated)
  }

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === questions.length - 1) return

    const updated = [...questions]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    ;[updated[index], updated[newIndex]] = [updated[newIndex], updated[index]]
    
    // Update order values
    updated.forEach((q, i) => {
      q.order = i + 1
    })
    
    setQuestions(updated)
  }

  const handleQuestionTypeChange = (index: number, questionType: QuestionType) => {
    const question = questions[index]
    updateQuestion(index, {
      question_type: questionType,
      // Clear options if switching away from multiple_choice, checkbox, or matrix types
      options: (questionType === 'multiple_choice' || questionType === 'checkbox' || questionType === 'matrix' || questionType === 'matrix_single') 
        ? question.options : null,
      // Clear allow_other if switching away from multiple_choice or checkbox
      allow_other: (questionType === 'multiple_choice' || questionType === 'checkbox') ? (question.allow_other || false) : false,
    })
    // Initialize matrix config if switching to matrix type
    if ((questionType === 'matrix' || questionType === 'matrix_single') && !matrixConfig[index]) {
      setMatrixConfig({
        ...matrixConfig,
        [index]: { 
          rows: 'First\nSecond\nThird\nFourth', 
          columns: 'Monday\nTuesday\nWednesday\nThursday\nFriday\nSaturday\nSunday' 
        }
      })
    }
  }

  const handleOptionsChange = (index: number, value: string) => {
    // Store the raw text value - don't parse it yet
    setOptionsText({ ...optionsText, [index]: value })
    
    // Parse and update the question options (for validation, but keep raw text for display)
    const options = value
      .split(/[\n,]/)
      .map((opt) => opt.trim())
      .filter((opt) => opt.length > 0)
    updateQuestion(index, { options: options.length > 0 ? options : null })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Don't submit if the active element is a textarea (user pressed Enter in textarea)
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLTextAreaElement) {
      return
    }
    
    setLoading(true)
    setError(null)

    // Validate that at least one question exists
    if (questions.length === 0) {
      setError('Please add at least one question to the survey')
      setLoading(false)
      return
    }

    // Validate that all questions have text
    const invalidQuestions = questions.filter(q => !q.question_text.trim())
    if (invalidQuestions.length > 0) {
      setError('All questions must have question text')
      setLoading(false)
      return
    }

    // Validate that questions with multiple_choice or checkbox have options
    const invalidOptions = questions.map((q, idx) => {
      const needsOptions = q.question_type === 'multiple_choice' || q.question_type === 'checkbox'
      if (needsOptions) {
        // Check if we have raw text or parsed options
        const rawText = optionsText[idx]
        const hasRawText = rawText && rawText.trim().length > 0
        const hasOptions = q.options && Array.isArray(q.options) && q.options.length > 0
        return !hasRawText && !hasOptions ? idx : null
      }
      return null
    }).filter(idx => idx !== null)
    
    if (invalidOptions.length > 0) {
      setError('Multiple choice and checkbox questions must have at least one option')
      setLoading(false)
      return
    }

    // Validate that matrix questions have both rows and columns configured
    const invalidMatrix = questions.map((q, idx) => {
      if (q.question_type === 'matrix' || q.question_type === 'matrix_single') {
        const config = matrixConfig[idx]
        if (!config) {
          return idx
        }
        const rows = config.rows?.split(/[\n,]/).map((opt) => opt.trim()).filter((opt) => opt.length > 0) || []
        const columns = config.columns?.split(/[\n,]/).map((opt) => opt.trim()).filter((opt) => opt.length > 0) || []
        if (rows.length === 0 || columns.length === 0) {
          return idx
        }
      }
      return null
    }).filter(idx => idx !== null)
    
    if (invalidMatrix.length > 0) {
      setError('Matrix questions must have at least one row and one column configured')
      setLoading(false)
      return
    }

    try {
      if (isEdit && surveyId) {
        // Update survey metadata
        await adminApi.updateSurvey(Number(surveyId), {
          title,
          description: description || null,
          event_id: eventId,
        })
        
        // Parse and save questions
        const parsedQuestions = questions.map((q, idx) => {
          const needsOptions = q.question_type === 'multiple_choice' || q.question_type === 'checkbox'
          const isMatrix = q.question_type === 'matrix' || q.question_type === 'matrix_single'
          let finalOptions = q.options
          
          // If we have raw text, parse it
          if (needsOptions && optionsText[idx] !== undefined) {
            const rawText = optionsText[idx]
            if (rawText && rawText.trim().length > 0) {
              const parsed = rawText
                .split(/[\n,]/)
                .map((opt) => opt.trim())
                .filter((opt) => opt.length > 0)
              if (parsed.length > 0) {
                finalOptions = parsed
              }
            }
          } else if (isMatrix) {
            // For matrix questions, parse rows and columns from matrixConfig
            const config = matrixConfig[idx]
            if (config && config.rows && config.columns) {
              const rows = config.rows
                .split(/[\n,]/)
                .map((opt) => opt.trim())
                .filter((opt) => opt.length > 0)
              const columns = config.columns
                .split(/[\n,]/)
                .map((opt) => opt.trim())
                .filter((opt) => opt.length > 0)
              
              if (rows.length > 0 && columns.length > 0) {
                finalOptions = { rows, columns }
              }
            }
          }
          
          return {
            question_type: q.question_type,
            question_text: q.question_text,
            options: finalOptions,
            allow_other: q.allow_other || false,
            required: q.required,
            order: q.order || idx + 1,
          }
        })
        
        // Get current questions to determine what to create/update/delete
        const currentQuestions = await adminApi.getSurveyQuestions(Number(surveyId))
        const currentQuestionIds = new Set(currentQuestions.map(q => q.id))
        const existingIdsSet = new Set(existingQuestionIds.filter(id => id !== 0)) // 0 means new question
        
        // Delete questions that were removed (exist in DB but not in our list)
        for (const question of currentQuestions) {
          if (!existingIdsSet.has(question.id)) {
            await adminApi.deleteSurveyQuestion(Number(surveyId), question.id)
          }
        }
        
        // Create or update questions
        for (let idx = 0; idx < parsedQuestions.length; idx++) {
          const questionData = parsedQuestions[idx]
          const existingId = existingQuestionIds[idx]
          
          if (existingId && existingId !== 0 && currentQuestionIds.has(existingId)) {
            // Update existing question
            await adminApi.updateSurveyQuestion(Number(surveyId), existingId, questionData)
          } else {
            // Create new question (existingId is 0 or doesn't exist)
            await adminApi.createSurveyQuestion(Number(surveyId), questionData)
          }
        }
        
        navigate('/admin/dashboard')
      } else {
        // Parse options from raw text before submitting
        const parsedQuestions = questions.map((q, idx) => {
          const needsOptions = q.question_type === 'multiple_choice' || q.question_type === 'checkbox'
          const isMatrix = q.question_type === 'matrix' || q.question_type === 'matrix_single'
          let finalOptions = q.options
          
          // If we have raw text, parse it
          if (needsOptions && optionsText[idx] !== undefined) {
            const rawText = optionsText[idx]
            if (rawText && rawText.trim().length > 0) {
              const parsed = rawText
                .split(/[\n,]/)
                .map((opt) => opt.trim())
                .filter((opt) => opt.length > 0)
              if (parsed.length > 0) {
                finalOptions = parsed
              }
            }
          } else if (isMatrix) {
            // For matrix questions, parse rows and columns from matrixConfig
            const config = matrixConfig[idx]
            if (config && config.rows && config.columns) {
              const rows = config.rows
                .split(/[\n,]/)
                .map((opt) => opt.trim())
                .filter((opt) => opt.length > 0)
              const columns = config.columns
                .split(/[\n,]/)
                .map((opt) => opt.trim())
                .filter((opt) => opt.length > 0)
              
              if (rows.length > 0 && columns.length > 0) {
                finalOptions = { rows, columns }
              } else {
                // Fallback to defaults if config is incomplete
                finalOptions = { 
                  rows: ['First', 'Second', 'Third', 'Fourth'], 
                  columns: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] 
                }
              }
            } else {
              // Fallback to defaults if no config exists
              finalOptions = { 
                rows: ['First', 'Second', 'Third', 'Fourth'], 
                columns: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] 
              }
            }
          }
          
          return {
            question_type: q.question_type,
            question_text: q.question_text,
            options: finalOptions,
            allow_other: q.allow_other || false,
            required: q.required,
            order: q.order || idx + 1,
          }
        })
        
        // Create new survey with questions
        const submitData: SurveyCreate = {
          title,
          description: description || null,
          event_id: eventId,
          questions: parsedQuestions,
        }
        await adminApi.createSurvey(submitData)
        navigate('/admin/dashboard')
      }
    } catch (err: any) {
      console.error('Survey submission error:', err)
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to save survey'
      setError(errorMessage)
      setLoading(false)
      // Don't navigate on error - let user see the error message
      return
    }
    
    setLoading(false)
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            {isEdit ? 'Edit Survey' : 'Create New Survey'}
          </h1>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form 
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
              // Prevent form submission when Enter is pressed in a textarea
              // Textareas should allow Enter to create new lines
              if (e.key === 'Enter' && e.target instanceof HTMLTextAreaElement) {
                // Don't prevent default - let textarea handle Enter normally
                // Just stop the event from bubbling to prevent form submission
                e.stopPropagation()
              }
            }}
            className="space-y-8"
          >
            {/* Survey Metadata */}
            <div className="space-y-6 border-b pb-6">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Survey Title *
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
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
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label htmlFor="event_id" className="block text-sm font-medium text-gray-700 mb-2">
                  Associated Event (optional)
                </label>
                <select
                  id="event_id"
                  value={eventId || ''}
                  onChange={(e) => setEventId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                >
                  <option value="">Standalone Survey (no event)</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title} - {new Date(event.date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Questions Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Questions</h2>
              </div>

              {questions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-4">No questions yet.</p>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
                  >
                    + Add Question
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {questions.map((question, index) => {
                    const needsOptions = question.question_type === 'multiple_choice' || question.question_type === 'checkbox'
                    const isMatrix = question.question_type === 'matrix' || question.question_type === 'matrix_single'
                    return (
                      <div key={index} className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="text-lg font-medium text-gray-900">Question {index + 1}</h3>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => moveQuestion(index, 'up')}
                              disabled={index === 0}
                              className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveQuestion(index, 'down')}
                              disabled={index === questions.length - 1}
                              className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              ↓
                            </button>
                            {questions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeQuestion(index)}
                                className="px-2 py-1 text-sm text-red-600 hover:text-red-700"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Question Type *
                            </label>
                            <select
                              value={question.question_type}
                              onChange={(e) => handleQuestionTypeChange(index, e.target.value as QuestionType)}
                              required
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                            >
                              <option value="text">Text Input</option>
                              <option value="multiple_choice">Multiple Choice</option>
                              <option value="checkbox">Checkbox (Multiple Selection)</option>
                              <option value="yes_no">Yes/No</option>
                              <option value="date_time">Date & Time</option>
                              <option value="matrix">Matrix (Scheduling - Multiple Selections)</option>
                              <option value="matrix_single">Matrix (Single Selection Per Row)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Question Text *
                            </label>
                            <textarea
                              value={question.question_text}
                              onChange={(e) => updateQuestion(index, { question_text: e.target.value })}
                              rows={3}
                              required
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                              placeholder="Enter your question here..."
                            />
                          </div>

                          {isMatrix && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Matrix Configuration
                              </label>
                              <div className="space-y-4 p-4 bg-white rounded-lg border border-gray-200">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Rows *
                                  </label>
                                  <textarea
                                    value={matrixConfig[index]?.rows || 
                                      (question.options && typeof question.options === 'object' && !Array.isArray(question.options) && question.options.rows
                                        ? (Array.isArray(question.options.rows) ? question.options.rows.join('\n') : question.options.rows)
                                        : 'First\nSecond\nThird\nFourth')}
                                    onChange={(e) => {
                                      setMatrixConfig({
                                        ...matrixConfig,
                                        [index]: {
                                          ...matrixConfig[index],
                                          rows: e.target.value,
                                          columns: matrixConfig[index]?.columns || ''
                                        }
                                      })
                                    }}
                                    onBlur={(e) => {
                                      const rowsValue = e.target.value
                                      const rows = rowsValue
                                        .split(/[\n,]/)
                                        .map((opt) => opt.trim())
                                        .filter((opt) => opt.length > 0)
                                      const columnsValue = matrixConfig[index]?.columns || ''
                                      const columns = columnsValue
                                        .split(/[\n,]/)
                                        .map((opt) => opt.trim())
                                        .filter((opt) => opt.length > 0)
                                      
                                      if (rows.length > 0 && columns.length > 0) {
                                        updateQuestion(index, { 
                                          options: { rows, columns }
                                        })
                                      }
                                    }}
                                    rows={6}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                    placeholder="First&#10;Second&#10;Third&#10;Fourth"
                                  />
                                  <p className="mt-1 text-sm text-gray-500">
                                    Enter each row label on a new line or separate with commas.
                                  </p>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Columns *
                                  </label>
                                  <textarea
                                    value={matrixConfig[index]?.columns || 
                                      (question.options && typeof question.options === 'object' && !Array.isArray(question.options) && question.options.columns
                                        ? (Array.isArray(question.options.columns) ? question.options.columns.join('\n') : question.options.columns)
                                        : 'Monday\nTuesday\nWednesday\nThursday\nFriday\nSaturday\nSunday')}
                                    onChange={(e) => {
                                      setMatrixConfig({
                                        ...matrixConfig,
                                        [index]: {
                                          ...matrixConfig[index],
                                          rows: matrixConfig[index]?.rows || '',
                                          columns: e.target.value
                                        }
                                      })
                                    }}
                                    onBlur={(e) => {
                                      const columnsValue = e.target.value
                                      const columns = columnsValue
                                        .split(/[\n,]/)
                                        .map((opt) => opt.trim())
                                        .filter((opt) => opt.length > 0)
                                      const rowsValue = matrixConfig[index]?.rows || ''
                                      const rows = rowsValue
                                        .split(/[\n,]/)
                                        .map((opt) => opt.trim())
                                        .filter((opt) => opt.length > 0)
                                      
                                      if (rows.length > 0 && columns.length > 0) {
                                        updateQuestion(index, { 
                                          options: { rows, columns }
                                        })
                                      }
                                    }}
                                    rows={8}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                    placeholder="Monday&#10;Tuesday&#10;Wednesday&#10;Thursday&#10;Friday&#10;Saturday&#10;Sunday"
                                  />
                                  <p className="mt-1 text-sm text-gray-500">
                                    Enter each column label on a new line or separate with commas.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                          {needsOptions && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Options * (one per line or comma-separated)
                              </label>
                              <textarea
                                value={optionsText[index] !== undefined ? optionsText[index] : (Array.isArray(question.options) ? question.options.join('\n') : '')}
                                onChange={(e) => handleOptionsChange(index, e.target.value)}
                                onBlur={(e) => {
                                  // Parse options when field loses focus to update the question
                                  const value = e.target.value
                                  const options = value
                                    .split(/[\n,]/)
                                    .map((opt) => opt.trim())
                                    .filter((opt) => opt.length > 0)
                                  updateQuestion(index, { options: options.length > 0 ? options : null })
                                }}
                                rows={6}
                                required={needsOptions}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                placeholder="Option 1&#10;Option 2&#10;Option 3"
                              />
                              <p className="mt-1 text-sm text-gray-500">
                                Enter each option on a new line or separate with commas
                              </p>
                            </div>
                          )}

                          {(question.question_type === 'multiple_choice' || question.question_type === 'checkbox') && (
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={question.allow_other || false}
                                onChange={(e) => updateQuestion(index, { allow_other: e.target.checked })}
                                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                              />
                              <label className="ml-2 block text-sm text-gray-700">
                                Allow "Other" option with text input
                              </label>
                            </div>
                          )}

                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={question.required}
                              onChange={(e) => updateQuestion(index, { required: e.target.checked })}
                              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                            />
                            <label className="ml-2 block text-sm text-gray-700">
                              Required field
                            </label>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  
                  {/* Add Question button at the end */}
                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={addQuestion}
                      className="w-full px-4 py-3 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium border-2 border-dashed border-purple-300"
                    >
                      + Add Question
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-6 border-t">
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
                {loading ? 'Saving...' : isEdit ? 'Update Survey' : 'Create Survey'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
