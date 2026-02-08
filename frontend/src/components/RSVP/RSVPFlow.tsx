import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { eventsApi } from '../../services/events'
import {
  getStoredRSVP,
  saveStoredRSVP,
  getEditTokenFromURL,
  clearEditTokenFromURL,
} from '../../services/rsvpStorage'
import { QuestionScreen } from './QuestionScreen'
import { IdentityInput } from './IdentityInput'
import { RSVPResponseInput } from './RSVPResponseInput'
import { ContactInfo } from './ContactInfo'
import { Transition } from '../Shared/Transition'
import { QuestionInput } from '../Survey/QuestionInput'
import { downloadCalendarFile, getGoogleCalendarUrl, isAppleDevice } from '../../utils/calendar'
import { formatDateWithTimezone } from '../../utils/timezone'
import type { RSVPFlowState, RSVPResponse } from '../../types/rsvp'
import type { Question } from '../../types/survey'

const RSVP_STEPS = 3 // Identity, Response, Contact Info

interface EditModeState {
  isEditing: boolean
  editToken: string | null
  submissionId: number | null
  previousIdentity: string | null
}

export const RSVPFlow = () => {
  const { invitationToken } = useParams<{ invitationToken: string }>()
  const [searchParams] = useSearchParams()
  const accessCodeParam = searchParams.get('code')

  const [state, setState] = useState<RSVPFlowState>({
    event: null,
    identity: '',
    response: null,
    num_attendees: null,
    email: '',
    phone: '',
    comment: '',
    accessCode: accessCodeParam || '',
    currentStep: 0,
    loading: true,
    error: null,
  })
  const [surveyAnswers, setSurveyAnswers] = useState<Record<number, string | string[] | boolean | Record<string, string> | { value: string; other_text: string } | { values: string[]; other_text: string } | null>>({})
  const [editMode, setEditMode] = useState<EditModeState>({
    isEditing: false,
    editToken: null,
    submissionId: null,
    previousIdentity: null,
  })

  useEffect(() => {
    const loadEvent = async () => {
      if (!invitationToken) {
        setState((prev) => ({ ...prev, error: 'Invalid invitation link', loading: false }))
        return
      }

      try {
        const event = await eventsApi.getEventByToken(
          invitationToken,
          state.accessCode || undefined
        )
        setState((prev) => ({ ...prev, event, loading: false }))

        // Check for edit token in URL (from email link)
        const urlEditToken = getEditTokenFromURL()
        if (urlEditToken) {
          clearEditTokenFromURL()
          await loadExistingRSVP(invitationToken, urlEditToken)
          return
        }

        // Check for stored RSVP in localStorage
        const storedRSVP = getStoredRSVP(invitationToken)
        if (storedRSVP) {
          await loadExistingRSVP(invitationToken, storedRSVP.editToken)
        }
      } catch (error: any) {
        const errorMessage =
          error.response?.status === 403
            ? 'Access code required or invalid'
            : error.response?.status === 404
            ? 'Event not found'
            : 'Failed to load event'
        setState((prev) => ({ ...prev, error: errorMessage, loading: false }))
      }
    }

    const loadExistingRSVP = async (token: string, editToken: string) => {
      try {
        const existingRSVP = await eventsApi.getMyRSVP(token, editToken)
        
        // Pre-populate form with existing data
        setState((prev) => ({
          ...prev,
          identity: existingRSVP.identity,
          response: existingRSVP.response as RSVPResponse,
          num_attendees: existingRSVP.num_attendees,
          email: existingRSVP.email || '',
          phone: existingRSVP.phone || '',
          comment: existingRSVP.comment || '',
        }))
        
        setEditMode({
          isEditing: true,
          editToken: editToken,
          submissionId: existingRSVP.id,
          previousIdentity: existingRSVP.identity,
        })

        // Also save/update in localStorage for this device
        saveStoredRSVP(token, {
          submissionId: existingRSVP.id,
          editToken: editToken,
          identity: existingRSVP.identity,
          response: existingRSVP.response,
        })
      } catch {
        // Token invalid or RSVP not found - proceed as new RSVP
        console.log('Could not load existing RSVP, proceeding as new submission')
      }
    }

    loadEvent()
  }, [invitationToken, state.accessCode])

  // Calculate total steps based on whether survey exists
  const getTotalSteps = () => {
    if (!state.event?.survey) return RSVP_STEPS + 1 // +1 for event details
    return 1 + (state.event.survey.questions.length || 0) + RSVP_STEPS // Event details + survey questions + RSVP steps
  }

  const isSurveyStep = (step: number) => {
    if (!state.event?.survey) return false
    return step > 0 && step <= state.event.survey.questions.length
  }

  const getCurrentSurveyQuestion = (): Question | null => {
    if (!state.event?.survey || !isSurveyStep(state.currentStep)) return null
    const questionIndex = state.currentStep - 1
    return state.event.survey.questions[questionIndex] || null
  }

  const handleNext = () => {
    const totalSteps = getTotalSteps()
    if (state.currentStep < totalSteps - 1) {
      setState((prev) => ({ ...prev, currentStep: prev.currentStep + 1 }))
    }
  }

  const handleBack = () => {
    if (state.currentStep > 0) {
      setState((prev) => ({ ...prev, currentStep: prev.currentStep - 1 }))
    }
  }

  const handleSubmit = async () => {
    if (!invitationToken || !state.event) return

    if (!state.identity || !state.response) {
      setState((prev) => ({ ...prev, error: 'Please complete all required fields' }))
      return
    }

    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      // Normalize survey answers
      const normalizedSurveyAnswers: Record<number, any> = {}
      if (state.event.survey) {
        for (const question of state.event.survey.questions) {
          let answer = surveyAnswers[question.id]
          
          // Normalize empty answers
          if (question.question_type === 'text' && (answer === null || answer === undefined)) {
            answer = ''
          }
          if (question.question_type === 'matrix_single' && (answer === null || answer === undefined)) {
            answer = {}
          }
          
          if (answer !== null && answer !== undefined) {
            // For matrix_single, check if dict has any entries
            if (question.question_type === 'matrix_single' && typeof answer === 'object' && !Array.isArray(answer)) {
              const dictAnswer = answer as Record<string, string>
              if (Object.keys(dictAnswer).length > 0) {
                normalizedSurveyAnswers[question.id] = dictAnswer
              } else if (!question.required) {
                normalizedSurveyAnswers[question.id] = {}
              }
            } else {
              normalizedSurveyAnswers[question.id] = answer
            }
          } else if (!question.required && question.question_type === 'text') {
            normalizedSurveyAnswers[question.id] = ''
          } else if (!question.required && question.question_type === 'matrix_single') {
            normalizedSurveyAnswers[question.id] = {}
          }
        }
      }

      if (editMode.isEditing && editMode.editToken) {
        // Update existing RSVP
        await eventsApi.updateRSVP(invitationToken, editMode.editToken, {
          identity: state.identity,
          response: state.response,
          num_attendees: (state.response === 'yes' || state.response === 'maybe') ? (state.num_attendees || undefined) : undefined,
          email: state.email || undefined,
          phone: state.phone || undefined,
          comment: state.comment || undefined,
          survey_responses: Object.keys(normalizedSurveyAnswers).length > 0 ? normalizedSurveyAnswers : undefined,
        })
        
        // Update stored RSVP
        saveStoredRSVP(invitationToken, {
          submissionId: editMode.submissionId!,
          editToken: editMode.editToken,
          identity: state.identity,
          response: state.response,
        })
      } else {
        // Create new RSVP
        const result = await eventsApi.submitRSVP(invitationToken, {
          identity: state.identity,
          response: state.response,
          num_attendees: (state.response === 'yes' || state.response === 'maybe') ? (state.num_attendees || undefined) : undefined,
          email: state.email || undefined,
          phone: state.phone || undefined,
          comment: state.comment || undefined,
          access_code: state.accessCode || undefined,
          survey_responses: Object.keys(normalizedSurveyAnswers).length > 0 ? normalizedSurveyAnswers : undefined,
        })
        
        // Save edit token for future edits
        saveStoredRSVP(invitationToken, {
          submissionId: result.id,
          editToken: result.edit_token,
          identity: state.identity,
          response: state.response,
        })
        
        // Update edit mode state in case they want to edit again
        setEditMode({
          isEditing: true,
          editToken: result.edit_token,
          submissionId: result.id,
          previousIdentity: state.identity,
        })
      }
      
      setState((prev) => ({ ...prev, currentStep: getTotalSteps(), loading: false }))
    } catch (error: any) {
      const errorMessage =
        error.response?.status === 403
          ? 'Invalid access code'
          : error.response?.status === 404
          ? 'Event not found'
          : 'Failed to submit RSVP. Please try again.'
      setState((prev) => ({ ...prev, error: errorMessage, loading: false }))
    }
  }

  const handleSurveyAnswerChange = (questionId: number, value: string | string[] | boolean | Record<string, string> | { value: string; other_text: string } | { values: string[]; other_text: string }) => {
    setSurveyAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const canProceedSurvey = () => {
    const question = getCurrentSurveyQuestion()
    if (!question) return true
    if (!question.required) return true
    
    const answer = surveyAnswers[question.id]
    if (answer === null || answer === undefined) return false
    
    // Check if answer is empty
    if (typeof answer === 'string' && answer.trim().length === 0) return false
    if (Array.isArray(answer) && answer.length === 0) return false
    if (typeof answer === 'object' && !Array.isArray(answer)) {
      // Check for "other" format
      if ('value' in answer && answer.value === 'other') {
        return answer.other_text && answer.other_text.trim().length > 0
      }
      if ('values' in answer && Array.isArray(answer.values)) {
        if (answer.values.includes('other')) {
          return answer.other_text && answer.other_text.trim().length > 0
        }
        return answer.values.length > 0
      }
      // Check for matrix_single format
      return Object.keys(answer).length > 0
    }
    
    return true
  }

  const canProceed = () => {
    if (state.currentStep === 0) {
      // Event details
      return true
    }
    
    // Survey questions
    if (isSurveyStep(state.currentStep)) {
      return canProceedSurvey()
    }
    
    // RSVP steps
    const surveyQuestionCount = state.event?.survey?.questions.length || 0
    const rsvpStep = state.currentStep - 1 - surveyQuestionCount
    
    switch (rsvpStep) {
      case 0: // Identity
        return state.identity.trim().length > 0
      case 1: // RSVP response
        if (state.response === null) return false
        // If response is "yes", num_attendees is required
        if (state.response === 'yes') {
          return state.num_attendees !== null && state.num_attendees > 0
        }
        return true
      case 2: // Contact info (optional)
        return true
      default:
        return false
    }
  }

  if (state.loading && state.currentStep === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading event...</p>
        </div>
      </div>
    )
  }

  if (state.error && state.currentStep === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">😔</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h2>
          <p className="text-gray-600 mb-6">{state.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!state.event) return null

  const totalSteps = getTotalSteps()
  const progress = ((state.currentStep + 1) / totalSteps) * 100

  return (
    <div className="min-h-screen">
      <AnimatePresence mode="wait">
        {state.currentStep === 0 && (
          <Transition key="event-details">
            <QuestionScreen
              title={state.event.title}
              onNext={handleNext}
              showBack={false}
              progress={progress}
              nextLabel={editMode.isEditing ? 'Edit Your RSVP' : 'RSVP Now'}
            >
              <div className="space-y-4">
                {editMode.isEditing && editMode.previousIdentity && (
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-purple-800 font-medium">
                      Welcome back, {editMode.previousIdentity}!
                    </p>
                    <p className="text-sm text-purple-600 mt-1">
                      You've already RSVP'd to this event. You can update your response below.
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-700">Date & Time</p>
                  <p className="text-gray-900">
                    {formatDateWithTimezone(state.event.date)}
                  </p>
                </div>
                {state.event.location && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Location</p>
                    <p className="text-gray-900">{state.event.location}</p>
                  </div>
                )}
                {state.event.has_access_code && !state.accessCode && (
                  <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      This event requires an access code. Please check your invitation.
                    </p>
                  </div>
                )}
              </div>
            </QuestionScreen>
          </Transition>
        )}

        {/* Survey Questions */}
        {isSurveyStep(state.currentStep) && (() => {
          const question = getCurrentSurveyQuestion()
          if (!question) return null
          const questionIndex = state.currentStep - 1
          const totalSurveyQuestions = state.event.survey?.questions.length || 0
          
          return (
            <Transition key={`survey-question-${question.id}`}>
              <QuestionScreen
                title={question.question_text}
                subtitle={question.required ? 'Required' : 'Optional'}
                onNext={canProceed() ? handleNext : undefined}
                onBack={handleBack}
                progress={progress}
              >
                <div className="space-y-4">
                  {totalSurveyQuestions > 1 && (
                    <div className="text-sm text-gray-500 mb-4">
                      Question {questionIndex + 1} of {totalSurveyQuestions}
                    </div>
                  )}
                  <QuestionInput
                    questionType={question.question_type}
                    questionText={question.question_text}
                    options={question.options}
                    allowOther={question.allow_other || false}
                    required={question.required}
                    value={surveyAnswers[question.id] ?? null}
                    onChange={(value) => handleSurveyAnswerChange(question.id, value)}
                  />
                </div>
              </QuestionScreen>
            </Transition>
          )
        })()}

        {/* RSVP Steps */}
        {(() => {
          const surveyQuestionCount = state.event?.survey?.questions.length || 0
          const rsvpStep = state.currentStep - 1 - surveyQuestionCount
          
          if (rsvpStep === 0) {
            return (
              <Transition key="identity">
                <QuestionScreen
                  title="Tell us about yourself"
                  onNext={canProceed() ? handleNext : undefined}
                  onBack={handleBack}
                  progress={progress}
                >
                  <IdentityInput
                    value={state.identity}
                    onChange={(value) => setState((prev) => ({ ...prev, identity: value }))}
                    showPublicWarning={state.event?.show_rsvp_list}
                  />
                </QuestionScreen>
              </Transition>
            )
          }
          
          if (rsvpStep === 1) {
            return (
              <Transition key="response">
                <QuestionScreen
                  title="Will you be attending?"
                  onNext={canProceed() ? handleNext : undefined}
                  onBack={handleBack}
                  progress={progress}
                >
                  <RSVPResponseInput
                    value={state.response}
                    numAttendees={state.num_attendees}
                    onChange={(value) => setState((prev) => ({ ...prev, response: value }))}
                    onNumAttendeesChange={(value) => setState((prev) => ({ ...prev, num_attendees: value }))}
                  />
                </QuestionScreen>
              </Transition>
            )
          }
          
          if (rsvpStep === 2) {
            return (
              <Transition key="contact">
                <QuestionScreen
                  title="Contact Information"
                  subtitle="Optional - Skip if you prefer"
                  onNext={handleSubmit}
                  onBack={handleBack}
                  nextLabel={state.loading ? 'Submitting...' : (editMode.isEditing ? 'Update RSVP' : 'Submit RSVP')}
                  progress={progress}
                >
                  <ContactInfo
                    email={state.email}
                    phone={state.phone}
                    comment={state.comment}
                    onEmailChange={(value) => setState((prev) => ({ ...prev, email: value }))}
                    onPhoneChange={(value) => setState((prev) => ({ ...prev, phone: value }))}
                    onCommentChange={(value) => setState((prev) => ({ ...prev, comment: value }))}
                  />
                  {state.error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">{state.error}</p>
                    </div>
                  )}
                </QuestionScreen>
              </Transition>
            )
          }
          
          return null
        })()}

        {state.currentStep === getTotalSteps() && (
          <Transition key="confirmation">
            <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">You're all set!</h2>
                <p className="text-gray-600 mb-6">
                  {editMode.isEditing 
                    ? 'Your RSVP has been updated successfully.'
                    : 'Your RSVP has been submitted successfully. We\'re excited to see you there!'}
                </p>
                <div className="text-sm text-gray-500 mb-6">
                  <p>Response: {state.response}</p>
                  {state.identity && <p>Identity: {state.identity}</p>}
                </div>
                {state.event && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <a
                        href={getGoogleCalendarUrl({
                          title: state.event.title,
                          description: state.event.description,
                          date: state.event.date,
                          location: state.event.location,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center px-3 py-1.5 text-sm bg-white border-2 border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 transition-all font-medium shadow-sm"
                      >
                        <svg
                          className="w-4 h-4 mr-1.5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Add to Google Calendar
                      </a>
                      {isAppleDevice() && (
                        <button
                          onClick={() => {
                            downloadCalendarFile({
                              title: state.event!.title,
                              description: state.event!.description,
                              date: state.event!.date,
                              location: state.event!.location,
                            })
                          }}
                          className="inline-flex items-center justify-center px-3 py-1.5 text-sm bg-white border-2 border-gray-500 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium shadow-sm"
                        >
                          <svg
                            className="w-4 h-4 mr-1.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          Add to Apple Calendar
                        </button>
                      )}
                      <button
                        onClick={() => {
                          downloadCalendarFile({
                            title: state.event!.title,
                            description: state.event!.description,
                            date: state.event!.date,
                            location: state.event!.location,
                          })
                        }}
                        className="inline-flex items-center justify-center px-3 py-1.5 text-sm bg-white border-2 border-purple-500 text-purple-600 rounded-lg hover:bg-purple-50 transition-all font-medium shadow-sm"
                      >
                        <svg
                          className="w-4 h-4 mr-1.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        Download .ics File
                      </button>
                    </div>
                    <div className="text-center">
                      <button
                        onClick={() => {
                          // Force navigation to landing page by using window.location
                          // This ensures a full page reload and resets to landing view
                          window.location.href = `/rsvp/${invitationToken}`
                        }}
                        className="inline-block px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-medium shadow-md"
                      >
                        View Event Details
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Transition>
        )}
      </AnimatePresence>
    </div>
  )
}

