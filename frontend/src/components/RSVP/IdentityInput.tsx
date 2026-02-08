interface IdentityInputProps {
  value: string
  onChange: (value: string) => void
  showPublicWarning?: boolean
}

export const IdentityInput = ({ value, onChange, showPublicWarning = false }: IdentityInputProps) => {
  return (
    <div>
      <label htmlFor="identity" className="block text-sm font-medium text-gray-700 mb-2">
        How would you like to be identified? *
      </label>
      <p className="text-sm text-gray-500 mb-4">
        This could be your name, alias, or how you'd like to appear on the guest list.
      </p>
      {showPublicWarning && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            <span className="font-medium">Note:</span> Your name will be visible to other guests on the RSVP page.
          </p>
        </div>
      )}
      <input
        id="identity"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your name or alias"
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
        required
      />
    </div>
  )
}


