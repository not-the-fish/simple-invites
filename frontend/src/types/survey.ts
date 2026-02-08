export type QuestionType = 'text' | 'multiple_choice' | 'checkbox' | 'yes_no' | 'date_time' | 'matrix' | 'matrix_single'

export interface Question {
  id: number
  question_type: QuestionType
  question_text: string
  options: string[] | null
  allow_other: boolean
  required: boolean
  order: number
}

export interface Survey {
  id: number
  event_id: number | null
  title: string
  description: string | null
  survey_token: string
  questions: Question[]
  created_at: string
  updated_at: string
}

export interface SurveyPublic {
  id: number
  title: string
  description: string | null
  questions: Question[]
}

export interface QuestionResponse {
  id: number
  submission_id: number
  question_id: number
  answer: string | string[] | boolean | Record<string, string> | null
}

export type RSVPResponse = 'yes' | 'no' | 'maybe'

export interface SurveySubmission {
  id: number
  survey_id: number
  submitted_at: string
  // RSVP fields (for event submissions)
  identity: string | null
  rsvp_response: RSVPResponse | null
  email: string | null
  phone: string | null
  question_responses: QuestionResponse[]
}

export interface SurveySubmissionCreate {
  answers: Record<number, string | string[] | boolean | Record<string, string> | { value: string; other_text: string } | { values: string[]; other_text: string } | null>  // question_id -> answer
}

export interface QuestionResponseGroup {
  question_id: number
  question_text: string
  question_type: string
  responses: QuestionResponse[]
}

