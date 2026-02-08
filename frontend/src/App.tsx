import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { RSVPPage } from './pages/RSVPPage'
import { SurveyPage } from './pages/SurveyPage'
import { LoginPage } from './pages/Admin/LoginPage'
import { Dashboard } from './pages/Admin/Dashboard'
import { EventDetailPage } from './pages/Admin/EventDetailPage'
import { EventFormPage } from './pages/Admin/EventFormPage'
import { RSVPsPage } from './pages/Admin/RSVPsPage'
import { SurveyFormPage } from './pages/Admin/SurveyFormPage'
import { SurveyDetailPage } from './pages/Admin/SurveyDetailPage'
import { SurveyResultsPage } from './pages/Admin/SurveyResultsPage'
import { ProtectedRoute } from './components/Admin/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { setAuthToken } from './services/admin'
import { getToken } from './utils/tokenStorage'
import { APP_NAME } from './config'

function App() {
  useEffect(() => {
    // Set document title based on app name
    document.title = APP_NAME

    // Initialize auth token on app load
    const token = getToken()
    if (token) {
      setAuthToken(token)
    }
  }, [])

  return (
    <ErrorBoundary>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
        {/* Public Routes */}
        <Route path="/rsvp/:invitationToken" element={<RSVPPage />} />
        <Route path="/survey/:surveyToken" element={<SurveyPage />} />
        <Route
          path="/"
          element={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                  {APP_NAME}
                </h1>
                <p className="text-gray-600 mb-4">
                  Welcome! Use an invitation link to RSVP to an event.
                </p>
                <a
                  href="/admin/login"
                  className="inline-block px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-medium"
                >
                  Admin Login
                </a>
              </div>
            </div>
          }
        />

        {/* Admin Routes */}
        <Route path="/admin/login" element={<LoginPage />} />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/events/new"
          element={
            <ProtectedRoute>
              <EventFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/events/:eventId"
          element={
            <ProtectedRoute>
              <EventDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/events/:eventId/edit"
          element={
            <ProtectedRoute>
              <EventFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/events/:eventId/rsvps"
          element={
            <ProtectedRoute>
              <RSVPsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/surveys/new"
          element={
            <ProtectedRoute>
              <SurveyFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/surveys/:surveyId"
          element={
            <ProtectedRoute>
              <SurveyDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/surveys/:surveyId/edit"
          element={
            <ProtectedRoute>
              <SurveyFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/surveys/:surveyId/responses"
          element={
            <ProtectedRoute>
              <SurveyResultsPage />
            </ProtectedRoute>
          }
        />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App

