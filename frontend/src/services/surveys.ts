import { api } from './api'
import type { SurveyPublic, SurveySubmission, SurveySubmissionCreate } from '../types/survey'

export const surveysApi = {
  async getSurveyByToken(surveyToken: string): Promise<SurveyPublic> {
    const response = await api.get<SurveyPublic>(`/api/surveys/${surveyToken}`)
    return response.data
  },

  async submitResponses(surveyToken: string, submissionData: SurveySubmissionCreate): Promise<SurveySubmission> {
    const response = await api.post<SurveySubmission>(
      `/api/surveys/${surveyToken}/responses`,
      submissionData
    )
    return response.data
  },
}

