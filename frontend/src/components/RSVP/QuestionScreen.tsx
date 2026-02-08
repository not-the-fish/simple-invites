import { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface QuestionScreenProps {
  title: string
  subtitle?: string
  children: ReactNode
  onNext?: () => void
  onBack?: () => void
  showBack?: boolean
  showNext?: boolean
  nextLabel?: string
  backLabel?: string
  progress?: number
}

export const QuestionScreen = ({
  title,
  subtitle,
  children,
  onNext,
  onBack,
  showBack = true,
  showNext = true,
  nextLabel = 'Next',
  backLabel = 'Back',
  progress,
}: QuestionScreenProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full"
      >
        {/* Progress bar */}
        {progress !== undefined && (
          <div className="mb-6">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}

        {/* Title */}
        <h2 className="text-3xl font-bold text-gray-900 mb-2">{title}</h2>
        {subtitle && <p className="text-gray-600 mb-8">{subtitle}</p>}

        {/* Content */}
        <div className="mb-8">{children}</div>

        {/* Navigation buttons */}
        <div className="flex justify-between gap-4">
          {showBack && onBack && (
            <button
              onClick={onBack}
              className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              {backLabel}
            </button>
          )}
          <div className="flex-1" />
          {showNext && onNext && (
            <button
              onClick={onNext}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-medium shadow-md"
            >
              {nextLabel}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}


