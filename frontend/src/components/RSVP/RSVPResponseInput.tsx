import { motion } from 'framer-motion'
import type { RSVPResponse } from '../../types/rsvp'

interface RSVPResponseInputProps {
  value: RSVPResponse | null
  numAttendees: number | null
  onChange: (value: RSVPResponse) => void
  onNumAttendeesChange: (value: number | null) => void
}

const options: { value: RSVPResponse; label: string; emoji: string }[] = [
  { value: 'yes', label: 'Yes, I\'ll be there!', emoji: '🎉' },
  { value: 'maybe', label: 'Maybe', emoji: '🤔' },
  { value: 'no', label: 'No, I can\'t make it', emoji: '😔' },
]

export const RSVPResponseInput = ({ value, numAttendees, onChange, onNumAttendeesChange }: RSVPResponseInputProps) => {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 mb-6">
        Will you be attending this event?
      </p>
      <div className="grid gap-4">
        {options.map((option) => (
          <motion.button
            key={option.value}
            onClick={() => {
              onChange(option.value)
              // Reset num_attendees if "no"
              if (option.value === 'no') {
                onNumAttendeesChange(null)
              } else if (numAttendees === null && option.value === 'yes') {
                // Default to 1 if selecting "yes" for the first time
                onNumAttendeesChange(1)
              }
            }}
            className={`p-6 rounded-xl border-2 text-left transition-all ${
              value === option.value
                ? 'border-purple-500 bg-purple-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">{option.emoji}</span>
              <span className="text-lg font-medium text-gray-900">{option.label}</span>
            </div>
          </motion.button>
        ))}
      </div>
      
      {(value === 'yes' || value === 'maybe') && (
        <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <label htmlFor="num_attendees" className="block text-sm font-medium text-gray-700 mb-2">
            How many people {value === 'yes' ? 'are coming' : 'might come'}? {value === 'yes' && '*'}
          </label>
          <input
            id="num_attendees"
            type="number"
            min="1"
            max="100"
            value={numAttendees || ''}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value, 10) : null
              onNumAttendeesChange(val && val > 0 ? val : null)
            }}
            required={value === 'yes'}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            placeholder="1"
          />
          <p className="mt-2 text-xs text-gray-600">
            {value === 'yes' ? 'Include yourself in the count' : 'Optional: If you know how many people might come, let us know'}
          </p>
        </div>
      )}
    </div>
  )
}

