import { useState } from 'react'
import { motion } from 'framer-motion'
import type { QuestionType } from '../../types/survey'
import type { MatrixConfig } from '../../types/admin'

type AnswerValue = string | string[] | boolean | Record<string, string> | { value: string; other_text: string } | { values: string[]; other_text: string }

interface QuestionInputProps {
  questionType: QuestionType
  questionText: string
  options?: string[] | MatrixConfig | null
  allowOther?: boolean
  required: boolean
  value: AnswerValue | null
  onChange: (value: AnswerValue) => void
}

export const QuestionInput = ({
  questionType,
  questionText: _questionText,
  options,
  allowOther = false,
  required,
  value,
  onChange,
}: QuestionInputProps) => {
  const [otherText, setOtherText] = useState('')
  if (questionType === 'text') {
    return (
      <div>
        <textarea
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
          placeholder="Type your answer here..."
        />
      </div>
    )
  }

  if (questionType === 'multiple_choice' && options && Array.isArray(options)) {
    // Check if "other" is selected
    const isOtherSelected = typeof value === 'object' && value !== null && !Array.isArray(value) && 'value' in value && (value as any).value === 'other'
    const currentOtherText = isOtherSelected ? ((value as any).other_text || '') : otherText
    
    return (
      <div className="space-y-3">
        {options.map((option: string, index: number) => {
          const isSelected = value === option || (typeof value === 'object' && value !== null && 'value' in value && (value as any).value === option)
          return (
            <motion.button
              key={index}
              onClick={() => onChange(option)}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-purple-500 bg-purple-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 ${
                    isSelected
                      ? 'border-purple-500 bg-purple-500'
                      : 'border-gray-300'
                  }`}
                >
                  {isSelected && (
                    <div className="w-full h-full rounded-full bg-white scale-50"></div>
                  )}
                </div>
                <span className="text-gray-900">{option}</span>
              </div>
            </motion.button>
          )
        })}
        {allowOther && (
          <>
            <motion.button
              onClick={() => {
                if (isOtherSelected) {
                  // Deselect "other"
                  onChange('')
                } else {
                  // Select "other"
                  onChange({ value: 'other', other_text: currentOtherText || '' })
                }
              }}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                isOtherSelected
                  ? 'border-purple-500 bg-purple-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 ${
                    isOtherSelected
                      ? 'border-purple-500 bg-purple-500'
                      : 'border-gray-300'
                  }`}
                >
                  {isOtherSelected && (
                    <div className="w-full h-full rounded-full bg-white scale-50"></div>
                  )}
                </div>
                <span className="text-gray-900">Other</span>
              </div>
            </motion.button>
            {isOtherSelected && (
              <div className="mt-2">
                <input
                  type="text"
                  value={currentOtherText}
                  onChange={(e) => {
                    const newText = e.target.value
                    setOtherText(newText)
                    onChange({ value: 'other', other_text: newText })
                  }}
                  placeholder="Please specify..."
                  className="w-full px-4 py-3 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  if (questionType === 'checkbox' && options && Array.isArray(options)) {
    // Handle both array format and dict format with other_text
    let selectedValues: string[] = []
    let currentOtherText = ''
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && 'values' in value) {
      // Dict format: { values: ["option1", "other"], other_text: "custom" }
      selectedValues = (value as any).values || []
      currentOtherText = (value as any).other_text || ''
    } else if (Array.isArray(value)) {
      // Array format: ["option1", "option2"]
      selectedValues = value
    }
    
    const isOtherSelected = selectedValues.includes('other')
    
    const toggleOption = (option: string) => {
      let newValues: string[]
      if (selectedValues.includes(option)) {
        newValues = selectedValues.filter((v) => v !== option)
      } else {
        newValues = [...selectedValues, option]
      }
      
      // If "other" is selected, use dict format; otherwise use array format
      if (newValues.includes('other')) {
        onChange({ values: newValues, other_text: option === 'other' ? currentOtherText : (currentOtherText || '') })
      } else {
        onChange(newValues)
      }
    }

    return (
      <div className="space-y-3">
        {options.map((option: string, index: number) => (
          <motion.button
            key={index}
            onClick={() => toggleOption(option)}
            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
              selectedValues.includes(option)
                ? 'border-purple-500 bg-purple-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  selectedValues.includes(option)
                    ? 'border-purple-500 bg-purple-500'
                    : 'border-gray-300'
                }`}
              >
                {selectedValues.includes(option) && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <span className="text-gray-900">{option}</span>
            </div>
          </motion.button>
        ))}
        {allowOther && (
          <>
            <motion.button
              onClick={() => toggleOption('other')}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                isOtherSelected
                  ? 'border-purple-500 bg-purple-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    isOtherSelected
                      ? 'border-purple-500 bg-purple-500'
                      : 'border-gray-300'
                  }`}
                >
                  {isOtherSelected && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-gray-900">Other</span>
              </div>
            </motion.button>
            {isOtherSelected && (
              <div className="mt-2">
                <input
                  type="text"
                  value={currentOtherText}
                  onChange={(e) => {
                    const newText = e.target.value
                    setOtherText(newText)
                    onChange({ values: selectedValues, other_text: newText })
                  }}
                  placeholder="Please specify..."
                  className="w-full px-4 py-3 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  if (questionType === 'yes_no') {
    // Explicitly check for boolean true/false, handling all possible value types
    const isYesSelected = value === true || value === 'yes' || value === 'Yes' || value === 'YES'
    // For "No", we need to explicitly check for false and ensure it's not null/undefined
    const isNoSelected = (value === false || value === 'no' || value === 'No' || value === 'NO') && value !== null && value !== undefined
    
    return (
      <div className="grid grid-cols-2 gap-4">
        <motion.button
          onClick={() => onChange(true)}
          className={`p-6 rounded-xl border-2 text-center transition-all ${
            isYesSelected
              ? 'border-purple-500 bg-purple-50 shadow-md'
              : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50'
          }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="text-3xl mb-2">✓</div>
          <div className="text-lg font-medium text-gray-900">Yes</div>
        </motion.button>
        <motion.button
          onClick={() => onChange(false)}
          className={`p-6 rounded-xl border-2 text-center transition-all ${
            isNoSelected
              ? 'border-purple-500 bg-purple-50 shadow-md'
              : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50'
          }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="text-3xl mb-2">✗</div>
          <div className="text-lg font-medium text-gray-900">No</div>
        </motion.button>
      </div>
    )
  }

  if (questionType === 'date_time') {
    return (
      <div>
        <input
          type="datetime-local"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
        />
      </div>
    )
  }

  if (questionType === 'matrix' && options) {
    // For matrix questions, options contains rows and columns
    // Parse the matrix configuration
    let rows: string[] = []
    let columns: string[] = []
    
    try {
      // Try to parse as JSON if it's a string
      const config = typeof options === 'string' ? JSON.parse(options) : options
      if (Array.isArray(config) && config.length === 2) {
        // Assume format: [rows, columns]
        rows = config[0] || []
        columns = config[1] || []
      } else if (config.rows && config.columns) {
        rows = config.rows
        columns = config.columns
      } else {
        // Fallback: assume options is already rows, and we need columns
        rows = ['First', 'Second', 'Third', 'Fourth']
        columns = options as string[]
      }
    } catch {
      // Fallback to default scheduling matrix
      rows = ['First', 'Second', 'Third', 'Fourth']
      columns = options as string[]
    }

    const selectedValues = (value as string[]) || []
    
    const toggleCell = (row: string, column: string) => {
      const cellValue = `${row} ${column}`
      if (selectedValues.includes(cellValue)) {
        onChange(selectedValues.filter((v) => v !== cellValue))
      } else {
        onChange([...selectedValues, cellValue])
      }
    }

    return (
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-left text-sm font-medium text-gray-700 border-b border-gray-200"></th>
                {columns.map((column) => (
                  <th
                    key={column}
                    className="p-2 text-center text-sm font-medium text-gray-700 border-b border-gray-200"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row}>
                  <td className="p-2 text-sm font-medium text-gray-700 border-r border-gray-200">
                    {row}
                  </td>
                  {columns.map((column) => {
                    const cellValue = `${row} ${column}`
                    const isSelected = selectedValues.includes(cellValue)
                    return (
                      <td key={column} className="p-2 border-b border-r border-gray-200">
                        <motion.button
                          onClick={() => toggleCell(row, column)}
                          className={`w-full h-10 rounded-lg border-2 transition-all ${
                            isSelected
                              ? 'border-purple-500 bg-purple-100'
                              : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50'
                          }`}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          {isSelected && (
                            <svg
                              className="w-5 h-5 mx-auto text-purple-600"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </motion.button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (questionType === 'matrix_single' && options) {
    // For matrix_single questions, options contains rows and columns
    // Parse the matrix configuration
    let rows: string[] = []
    let columns: string[] = []
    
    try {
      // Try to parse as JSON if it's a string
      const config = typeof options === 'string' ? JSON.parse(options) : options
      if (Array.isArray(config) && config.length === 2) {
        // Assume format: [rows, columns]
        rows = config[0] || []
        columns = config[1] || []
      } else if (config.rows && config.columns) {
        rows = config.rows
        columns = config.columns
      } else {
        // Fallback: assume options is already rows, and we need columns
        rows = options as string[]
        columns = []
      }
    } catch {
      // Fallback
      rows = options as string[]
      columns = []
    }

    const selectedValues = (value as Record<string, string>) || {}
    
    const selectCell = (row: string, column: string) => {
      // For matrix_single, only one column per row is allowed
      // If clicking the same cell, deselect it (toggle)
      if (selectedValues[row] === column) {
        const newValues = { ...selectedValues }
        delete newValues[row]
        onChange(newValues)
      } else {
        // Set this row to this column (replacing any previous selection for this row)
        onChange({ ...selectedValues, [row]: column })
      }
    }

    return (
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-left text-sm font-medium text-gray-700 border-b border-gray-200"></th>
                {columns.map((column) => (
                  <th
                    key={column}
                    className="p-2 text-center text-sm font-medium text-gray-700 border-b border-gray-200"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row}>
                  <td className="p-2 text-sm font-medium text-gray-700 border-r border-gray-200">
                    {row}
                  </td>
                  {columns.map((column) => {
                    const isSelected = selectedValues[row] === column
                    return (
                      <td key={column} className="p-2 border-b border-r border-gray-200">
                        <motion.button
                          onClick={() => selectCell(row, column)}
                          className={`w-full h-10 rounded-lg border-2 transition-all ${
                            isSelected
                              ? 'border-purple-500 bg-purple-100'
                              : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50'
                          }`}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          {isSelected && (
                            <svg
                              className="w-5 h-5 mx-auto text-purple-600"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </motion.button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return <div>Unsupported question type</div>
}

