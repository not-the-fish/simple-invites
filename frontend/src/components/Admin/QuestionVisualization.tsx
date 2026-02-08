import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import type { QuestionResponseGroup } from '../../types/survey'

interface QuestionVisualizationProps {
  group: QuestionResponseGroup
  questionType: string
}

const COLORS = ['#9333ea', '#ec4899', '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe', '#e9d5ff']
const SKIPPED_COLOR = '#9ca3af'

export const QuestionVisualization = ({ group, questionType }: QuestionVisualizationProps) => {
  const [hideSkipped, setHideSkipped] = useState(false)

  // Process responses for visualization
  const chartData = useMemo(() => {
    if (questionType === 'yes_no') {
      // Pie chart data for yes/no questions
      const yesCount = group.responses.filter(r => r.answer === true || r.answer === 'yes').length
      const noCount = group.responses.filter(r => r.answer === false || r.answer === 'no').length
      const skippedCount = group.responses.filter(r => 
        r.answer === null || 
        r.answer === undefined || 
        r.answer === '' ||
        (typeof r.answer === 'string' && r.answer.trim() === '')
      ).length

      const data = [
        { name: 'Yes', value: yesCount },
        { name: 'No', value: noCount },
      ]

      if (!hideSkipped && skippedCount > 0) {
        data.push({ name: 'Skipped', value: skippedCount })
      }

      return data.filter(d => d.value > 0)
    } else if (questionType === 'multiple_choice' || questionType === 'checkbox') {
      // Bar chart data for multiple choice and checkbox questions
      const optionCounts: Record<string, number> = {}
      let skippedCount = 0

      group.responses.forEach(response => {
        if (response.answer === null || 
            response.answer === undefined || 
            response.answer === '' ||
            (typeof response.answer === 'string' && response.answer.trim() === '') ||
            (Array.isArray(response.answer) && response.answer.length === 0)) {
          skippedCount++
          return
        }

        if (Array.isArray(response.answer)) {
          // For checkbox questions, count each selected option
          response.answer.forEach((option: string) => {
            optionCounts[option] = (optionCounts[option] || 0) + 1
          })
        } else {
          // For multiple choice questions, count the single selection
          const option = String(response.answer)
          optionCounts[option] = (optionCounts[option] || 0) + 1
        }
      })

      const data = Object.entries(optionCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value) // Sort by count descending

      // Note: hideSkipped doesn't apply to bar charts, but we'll include skipped if present
      if (skippedCount > 0) {
        data.push({ name: 'Skipped', value: skippedCount })
      }

      return data
    } else if (questionType === 'matrix') {
      // Matrix chart data - count selections for each cell
      const cellCounts: Record<string, number> = {}
      let skippedCount = 0

      group.responses.forEach(response => {
        if (response.answer === null || 
            response.answer === undefined || 
            (Array.isArray(response.answer) && response.answer.length === 0)) {
          skippedCount++
          return
        }

        if (Array.isArray(response.answer)) {
          // Count each selected cell
          response.answer.forEach((cell: string) => {
            if (typeof cell === 'string' && cell.trim().length > 0) {
              cellCounts[cell] = (cellCounts[cell] || 0) + 1
            }
          })
        }
      })

      const data = Object.entries(cellCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value) // Sort by count descending

      if (skippedCount > 0) {
        data.push({ name: 'Skipped', value: skippedCount })
      }

      return data
    } else if (questionType === 'matrix_single') {
      // Matrix single chart data - count selections for each cell (one per row)
      const cellCounts: Record<string, number> = {}
      let skippedCount = 0

      group.responses.forEach(response => {
        if (response.answer === null || 
            response.answer === undefined || 
            (typeof response.answer === 'object' && !Array.isArray(response.answer) && Object.keys(response.answer).length === 0)) {
          skippedCount++
          return
        }

        if (typeof response.answer === 'object' && !Array.isArray(response.answer)) {
          // Count each row->column selection
          const dictAnswer = response.answer as Record<string, string>
          Object.entries(dictAnswer).forEach(([row, column]) => {
            const cellKey = `${row}: ${column}`
            cellCounts[cellKey] = (cellCounts[cellKey] || 0) + 1
          })
        }
      })

      const data = Object.entries(cellCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value) // Sort by count descending

      if (skippedCount > 0) {
        data.push({ name: 'Skipped', value: skippedCount })
      }

      return data
    }

    return []
  }, [group.responses, questionType, hideSkipped])

  if (chartData.length === 0) {
    return null
  }

  if (questionType === 'yes_no') {
    const totalResponses = chartData.reduce((sum, d) => sum + d.value, 0)
    const hasSkipped = chartData.some(d => d.name === 'Skipped')
    
    return (
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700">Response Distribution</h4>
            <p className="text-xs text-gray-500 mt-1">Total responses: {totalResponses}</p>
          </div>
          {hasSkipped && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={hideSkipped}
                onChange={(e) => setHideSkipped(e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              Hide skipped
            </label>
          )}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value, percent }) => `${name}: ${value} (${percent ? (percent * 100).toFixed(1) : '0'}%)`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => {
                let fillColor = COLORS[index % COLORS.length]
                if (entry.name === 'Skipped') {
                  fillColor = SKIPPED_COLOR
                } else if (entry.name === 'Yes') {
                  fillColor = COLORS[0]
                } else if (entry.name === 'No') {
                  fillColor = COLORS[1]
                }
                return <Cell key={`cell-${index}`} fill={fillColor} />
              })}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (questionType === 'multiple_choice' || questionType === 'checkbox') {
    const maxValue = Math.max(...chartData.map(d => d.value))
    const isHorizontal = maxValue > 10 || chartData.length > 5
    const totalSelections = chartData.reduce((sum, d) => sum + d.value, 0)
    const skippedCount = chartData.find(d => d.name === 'Skipped')?.value || 0
    const totalResponses = group.responses.length

    return (
      <div className="mt-6">
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700">Response Distribution</h4>
          <p className="text-xs text-gray-500 mt-1">
            {questionType === 'checkbox' 
              ? `Total selections: ${totalSelections} across ${totalResponses} responses`
              : `Total responses: ${totalResponses}${skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}`
            }
          </p>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 50)}>
          {isHorizontal ? (
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={90}
                tick={{ fontSize: 12 }}
              />
              <Tooltip />
              <Bar 
                dataKey="value" 
                fill="#9333ea"
                radius={[0, 4, 4, 0]}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.name === 'Skipped' ? SKIPPED_COLOR : COLORS[index % COLORS.length]} 
                  />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip />
              <Bar 
                dataKey="value" 
                fill="#9333ea"
                radius={[4, 4, 0, 0]}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.name === 'Skipped' ? SKIPPED_COLOR : COLORS[index % COLORS.length]} 
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    )
  }

  if (questionType === 'matrix' || questionType === 'matrix_single') {
    const totalSelections = chartData.reduce((sum, d) => sum + d.value, 0)
    const skippedCount = chartData.find(d => d.name === 'Skipped')?.value || 0
    const totalResponses = group.responses.length

    return (
      <div className="mt-6">
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700">Response Distribution</h4>
          <p className="text-xs text-gray-500 mt-1">
            Total selections: {totalSelections} across {totalResponses} responses
            {skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}
          </p>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 40)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={140}
              tick={{ fontSize: 11 }}
            />
            <Tooltip />
            <Bar 
              dataKey="value" 
              fill="#9333ea"
              radius={[0, 4, 4, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.name === 'Skipped' ? SKIPPED_COLOR : COLORS[index % COLORS.length]} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return null
}

