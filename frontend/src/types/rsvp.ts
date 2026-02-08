export type RSVPResponse = 'yes' | 'no' | 'maybe'

import type { SurveyPublic } from './survey'

export interface Event {
  id: number
  title: string
  description: string | null
  date: string
  location: string | null
  has_access_code: boolean
  show_rsvp_list: boolean
  survey: SurveyPublic | null
}

export interface RSVPData {
  identity: string
  response: RSVPResponse
  num_attendees?: number
  email?: string
  phone?: string
  comment?: string
  access_code?: string
  survey_responses?: Record<number, string | string[] | boolean | Record<string, string> | { value: string; other_text: string } | { values: string[]; other_text: string } | null>
}

export interface RSVPSubmission {
  id: number
  survey_id: number  // Changed from event_id - can get event via survey.event_id
  identity: string
  response: RSVPResponse
  num_attendees: number | null
  email: string | null
  phone: string | null
  comment: string | null
  submitted_at: string
}

/**
 * Response from creating a new RSVP - includes edit_token for future modifications.
 */
export interface RSVPSubmissionWithToken extends RSVPSubmission {
  edit_token: string
}

/**
 * Data for updating an existing RSVP.
 */
export interface RSVPUpdateData {
  identity: string
  response: RSVPResponse
  num_attendees?: number
  email?: string
  phone?: string
  comment?: string
  survey_responses?: Record<number, string | string[] | boolean | Record<string, string> | { value: string; other_text: string } | { values: string[]; other_text: string } | null>
}

export interface RSVPFlowState {
  event: Event | null
  identity: string
  response: RSVPResponse | null
  num_attendees: number | null
  email: string
  phone: string
  comment: string
  accessCode: string
  currentStep: number
  loading: boolean
  error: string | null
}

