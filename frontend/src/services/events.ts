import { api } from './api'
import type { Event, RSVPData, RSVPSubmission, RSVPSubmissionWithToken, RSVPUpdateData } from '../types/rsvp'

export const eventsApi = {
  async getEventByToken(invitationToken: string, accessCode?: string): Promise<Event> {
    const params = accessCode ? { access_code: accessCode } : {}
    const response = await api.get<Event>(`/api/events/${invitationToken}`, { params })
    return response.data
  },

  async submitRSVP(
    invitationToken: string,
    rsvpData: RSVPData
  ): Promise<RSVPSubmissionWithToken> {
    const response = await api.post<RSVPSubmissionWithToken>(
      `/api/events/${invitationToken}/rsvp`,
      rsvpData
    )
    return response.data
  },

  /**
   * Get an existing RSVP using the edit token.
   */
  async getMyRSVP(
    invitationToken: string,
    editToken: string
  ): Promise<RSVPSubmission> {
    const response = await api.get<RSVPSubmission>(
      `/api/events/${invitationToken}/my-rsvp`,
      { params: { edit_token: editToken } }
    )
    return response.data
  },

  /**
   * Update an existing RSVP using the edit token.
   */
  async updateRSVP(
    invitationToken: string,
    editToken: string,
    rsvpData: RSVPUpdateData
  ): Promise<RSVPSubmission> {
    const response = await api.put<RSVPSubmission>(
      `/api/events/${invitationToken}/rsvp`,
      rsvpData,
      { params: { edit_token: editToken } }
    )
    return response.data
  },

  async getRSVPStats(
    invitationToken: string,
    accessCode?: string
  ): Promise<{
    event_title: string
    event_description: string | null
    event_date: string
    event_location: string | null
    total_rsvps: number
    yes_count: number
    yes_attendees: number
    no_count: number
    maybe_count: number
    maybe_attendees: number
    has_survey: boolean
    show_rsvp_list: boolean
    attendees?: {
      yes: Array<{ name: string; num_attendees: number }>
      maybe: Array<{ name: string; num_attendees: number }>
    }
  }> {
    const params = accessCode ? { access_code: accessCode } : {}
    const response = await api.get(`/api/events/${invitationToken}/stats`, { params })
    return response.data
  },
}

