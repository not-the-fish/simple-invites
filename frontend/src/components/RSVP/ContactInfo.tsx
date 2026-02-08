
interface ContactInfoProps {
  email: string
  phone: string
  comment: string
  onEmailChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onCommentChange: (value: string) => void
}

export const ContactInfo = ({
  email,
  phone,
  comment,
  onEmailChange,
  onPhoneChange,
  onCommentChange,
}: ContactInfoProps) => {
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 mb-4">
        Optional: Share your contact information if you'd like to receive updates about the event.
      </p>
      
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="your.email@example.com"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
        />
        <p className="mt-2 text-xs text-gray-500">
          Add your email to edit your RSVP from any device or if your browser data is cleared. Without an email, you can still edit on this device.
        </p>
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
          Phone
        </label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="(555) 123-4567"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
        />
      </div>

      <div>
        <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
          Comment (Optional)
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Any additional comments or notes..."
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-y"
        />
      </div>
    </div>
  )
}

