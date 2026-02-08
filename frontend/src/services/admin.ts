import { api } from './api'
import type { Event, EventCreate, EventUpdate, Survey, SurveyCreate, SurveyUpdate, Question, QuestionCreate, QuestionUpdate } from '../types/admin'
import type { RSVPSubmission } from '../types/rsvp'
import type { QuestionResponse, SurveySubmission, QuestionResponseGroup } from '../types/survey'

export const adminApi = {
  async login(email: string, password: string): Promise<{ access_token: string; token_type: string }> {
    const response = await api.post('/api/admin/login', { email, password })
    return response.data
  },

  async getMe(): Promise<any> {
    const response = await api.get('/api/admin/me')
    return response.data
  },

  async listEvents(): Promise<Event[]> {
    const response = await api.get('/api/admin/events')
    return response.data
  },

  async getEvent(eventId: number): Promise<Event> {
    const response = await api.get(`/api/admin/events/${eventId}`)
    return response.data
  },

  async createEvent(eventData: EventCreate): Promise<Event> {
    const response = await api.post('/api/admin/events', eventData)
    return response.data
  },

  async updateEvent(eventId: number, eventData: EventUpdate): Promise<Event> {
    const response = await api.put(`/api/admin/events/${eventId}`, eventData)
    return response.data
  },

  async deleteEvent(eventId: number): Promise<void> {
    await api.delete(`/api/admin/events/${eventId}`)
  },

  async getEventRSVPs(eventId: number): Promise<RSVPSubmission[]> {
    const response = await api.get(`/api/admin/events/${eventId}/rsvps`)
    return response.data
  },

  async deleteRSVP(eventId: number, rsvpId: number): Promise<void> {
    await api.delete(`/api/admin/events/${eventId}/rsvps/${rsvpId}`)
  },

  async listSurveys(): Promise<Survey[]> {
    const response = await api.get('/api/admin/surveys')
    return response.data
  },

  async getSurvey(surveyId: number): Promise<Survey> {
    const response = await api.get(`/api/admin/surveys/${surveyId}`)
    return response.data
  },

  async createSurvey(surveyData: SurveyCreate): Promise<Survey> {
    const response = await api.post('/api/admin/surveys', surveyData)
    return response.data
  },

  async updateSurvey(surveyId: number, surveyData: SurveyUpdate): Promise<Survey> {
    const response = await api.put(`/api/admin/surveys/${surveyId}`, surveyData)
    return response.data
  },

  async deleteSurvey(surveyId: number): Promise<void> {
    await api.delete(`/api/admin/surveys/${surveyId}`)
  },

  async getSurveySubmissions(surveyId: number): Promise<SurveySubmission[]> {
    const response = await api.get(`/api/admin/surveys/${surveyId}/submissions`)
    return response.data
  },

  async getSurveyResponses(surveyId: number): Promise<QuestionResponse[]> {
    const response = await api.get(`/api/admin/surveys/${surveyId}/responses`)
    return response.data
  },

  async getSurveyResponsesByQuestion(surveyId: number): Promise<QuestionResponseGroup[]> {
    const response = await api.get(`/api/admin/surveys/${surveyId}/responses/by-question`)
    return response.data
  },

  async getSurveyQuestions(surveyId: number): Promise<Question[]> {
    const response = await api.get(`/api/admin/surveys/${surveyId}/questions`)
    return response.data
  },

  async createSurveyQuestion(surveyId: number, questionData: QuestionCreate): Promise<Question> {
    const response = await api.post(`/api/admin/surveys/${surveyId}/questions`, questionData)
    return response.data
  },

  async updateSurveyQuestion(surveyId: number, questionId: number, questionData: QuestionUpdate): Promise<Question> {
    const response = await api.put(`/api/admin/surveys/${surveyId}/questions/${questionId}`, questionData)
    return response.data
  },

  async deleteSurveyQuestion(surveyId: number, questionId: number): Promise<void> {
    await api.delete(`/api/admin/surveys/${surveyId}/questions/${questionId}`)
  },
}

// Set auth token for API requests
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common['Authorization']
  }
}

