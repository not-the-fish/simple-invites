import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { surveysApi } from '../../services/surveys'
import { QuestionScreen } from '../RSVP/QuestionScreen'
import { Transition } from '../Shared/Transition'
import { QuestionInput } from './QuestionInput'
import type { SurveyPublic } from '../../types/survey'

export const SurveyFlow = () => {
  const { surveyToken } = useParams<{ surveyToken: string }>()
  const [survey, setSurvey] = useState<SurveyPublic | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string | string[] | boolean | Record<string, string> | { value: string; other_text: string } | { values: string[]; other_text: string } | null>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const loadSurvey = async () => {
      if (!surveyToken) {
        setError('Invalid survey link')
        setLoading(false)
        return
      }

      try {
        const data = await surveysApi.getSurveyByToken(surveyToken)
        // Sort questions by order
        const sortedQuestions = [...data.questions].sort((a, b) => a.order - b.order)
        setSurvey({ ...data, questions: sortedQuestions })
      } catch (err: any) {
        const errorMessage =
          err.response?.status === 404
            ? 'Survey not found'
            : 'Failed to load survey'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadSurvey()
  }, [surveyToken])

  const currentQuestion = survey?.questions[currentQuestionIndex]
  const totalQuestions = survey?.questions.length || 0
  const progress = totalQuestions > 0 ? ((currentQuestionIndex + 1) / totalQuestions) * 100 : 0

  const handleNext = () => {
    if (!currentQuestion) return

    // Validate current question if required
    const currentAnswer = answers[currentQuestion.id]
    if (currentQuestion.required) {
      if (currentAnswer === null || currentAnswer === undefined || 
          currentAnswer === '' || 
          (Array.isArray(currentAnswer) && currentAnswer.length === 0)) {
        setError('This question is required. Please provide an answer.')
        return
      }
    }

    setError(null)

    // Move to next question or submit
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      handleSubmit()
    }
  }

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
      setError(null)
    }
  }

  const handleSubmit = async () => {
    if (!survey || !surveyToken) return

    setSubmitting(true)
    setError(null)

    try {
      // Normalize answers: convert null to empty string for text questions
      const normalizedAnswers: Record<number, string | string[] | boolean | Record<string, string> | { value: string; other_text: string } | { values: string[]; other_text: string } | null> = {}
      for (const question of survey.questions) {
        let answer = answers[question.id]
        
        // Normalize empty answers for text questions
        if (question.question_type === 'text' && (answer === null || answer === undefined)) {
          answer = ''
        }
        
        // Normalize empty dict for matrix_single questions
        if (question.question_type === 'matrix_single' && (answer === null || answer === undefined)) {
          answer = {}
        }
        
        // Only include answers that were provided (or empty strings for optional text questions, or empty dict for optional matrix_single)
        if (answer !== null && answer !== undefined) {
          // For matrix_single, check if dict has any entries
          if (question.question_type === 'matrix_single' && typeof answer === 'object' && !Array.isArray(answer)) {
            const dictAnswer = answer as Record<string, string>
            if (Object.keys(dictAnswer).length > 0) {
              normalizedAnswers[question.id] = dictAnswer
            } else if (!question.required) {
              normalizedAnswers[question.id] = {}
            }
          } else {
            normalizedAnswers[question.id] = answer
          }
        } else if (!question.required && question.question_type === 'text') {
          normalizedAnswers[question.id] = ''
        } else if (!question.required && question.question_type === 'matrix_single') {
          normalizedAnswers[question.id] = {}
        }
      }

      await surveysApi.submitResponses(surveyToken, { answers: normalizedAnswers })
      setSubmitted(true)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit responses. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const canProceed = () => {
    if (!currentQuestion) return false
    
    const currentAnswer = answers[currentQuestion.id]
    
    // If not required, can always proceed
    if (!currentQuestion.required) return true
    
    // If required, check if answer is provided
    if (currentAnswer === null || currentAnswer === undefined || currentAnswer === '') return false
    if (Array.isArray(currentAnswer) && currentAnswer.length === 0) return false
    
    return true
  }

  const handleAnswerChange = (value: string | string[] | boolean | Record<string, string> | { value: string; other_text: string } | { values: string[]; other_text: string }) => {
    if (!currentQuestion) return
    setAnswers({ ...answers, [currentQuestion.id]: value })
    setError(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading survey...</p>
        </div>
      </div>
    )
  }

  if (error && !survey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">😔</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h2>
          <p className="text-gray-600 mb-6">{error}</p>
        </div>
      </div>
    )
  }

  if (!survey || !currentQuestion) return null

  if (submitted) {
    return (
      <Transition>
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank you!</h2>
            <p className="text-gray-600 mb-6">
              Your responses have been submitted successfully.
            </p>
          </div>
        </div>
      </Transition>
    )
  }

  return (
    <div className="min-h-screen">
      <AnimatePresence mode="wait">
        <Transition key={`question-${currentQuestionIndex}`}>
          <QuestionScreen
            title={currentQuestionIndex === 0 ? (survey.title ?? 'Survey') : `Question ${currentQuestionIndex + 1}`}
            subtitle={currentQuestionIndex === 0 ? (survey.description || undefined) : undefined}
            onNext={canProceed() ? handleNext : undefined}
            onBack={currentQuestionIndex > 0 ? handleBack : undefined}
            nextLabel={
              submitting 
                ? 'Submitting...' 
                : currentQuestionIndex === totalQuestions - 1 
                  ? 'Submit' 
                  : 'Next'
            }
            progress={progress}
          >
            <div className="space-y-4">
              {totalQuestions > 1 && (
                <div className="text-sm text-gray-500 mb-4">
                  Question {currentQuestionIndex + 1} of {totalQuestions}
                </div>
              )}
              <p className="text-lg text-gray-900 mb-6">{currentQuestion.question_text}</p>
              <QuestionInput
                questionType={currentQuestion.question_type}
                questionText={currentQuestion.question_text}
                options={currentQuestion.options}
                allowOther={currentQuestion.allow_other || false}
                required={currentQuestion.required}
                value={answers[currentQuestion.id] ?? null}
                onChange={handleAnswerChange}
              />
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
            </div>
          </QuestionScreen>
        </Transition>
      </AnimatePresence>
    </div>
  )
}
