export interface Admin {
  id: number
  email: string
  is_active: boolean
  created_at: string
}

export interface Event {
  id: number
  title: string
  description: string | null
  date: string
  location: string | null
  invitation_token: string
  access_code: string | null
  show_rsvp_list: boolean
  survey_id: number  // Required - events always have a survey
  created_by: number
  created_at: string
  updated_at: string
}

export interface EventResponse {
  id: number
  title: string
  description: string | null
  date: string
  location: string | null
  invitation_token: string
  access_code: string | null
  show_rsvp_list: boolean
  survey_id: number
  created_at: string
  updated_at: string
}

export interface EventCreate {
  title: string
  description?: string | null
  date: string
  location?: string | null
  access_code?: string | null
  show_rsvp_list?: boolean
  survey_id?: number | null  // Optional: link to existing survey
  survey_description?: string | null
  survey_questions?: QuestionCreate[]
}

export interface EventUpdate {
  title?: string
  description?: string | null
  date?: string
  location?: string | null
  access_code?: string | null
  show_rsvp_list?: boolean
  survey_id?: number | null
}

export type QuestionType = 'text' | 'multiple_choice' | 'checkbox' | 'yes_no' | 'date_time' | 'matrix' | 'matrix_single'

export interface MatrixConfig {
  rows: string[]
  columns: string[]
}

export interface Question {
  id: number
  question_type: QuestionType
  question_text: string
  options: string[] | MatrixConfig | null
  allow_other: boolean
  required: boolean
  order: number
}

export interface QuestionCreate {
  question_type: QuestionType
  question_text: string
  options?: string[] | MatrixConfig | null
  allow_other?: boolean
  required?: boolean
  order?: number
}

export interface QuestionUpdate {
  question_type?: QuestionType
  question_text?: string
  options?: string[] | MatrixConfig | null
  allow_other?: boolean
  required?: boolean
  order?: number
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

export interface SurveyCreate {
  event_id?: number | null
  title: string
  description?: string | null
  questions: QuestionCreate[]
}

export interface SurveyUpdate {
  event_id?: number | null
  title?: string
  description?: string | null
}

