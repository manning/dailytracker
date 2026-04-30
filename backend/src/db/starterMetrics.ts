export const STARTER_METRICS = [
  { name: 'Weight',     type: 'NUMBER'   as const, unit: 'lbs',   color: '#3b82f6', order: 0, allowMultiplePerDay: false },
  { name: 'Time Asleep', type: 'DURATION' as const, unit: 'hours', color: '#8b5cf6', order: 1, allowMultiplePerDay: false },
  { name: 'Mood',       type: 'SCALE' as const, color: '#f59e0b', order: 2, allowMultiplePerDay: false, scaleMin: 1, scaleMax: 10 },
  { name: 'Pain Level', type: 'SCALE' as const, color: '#ef4444', order: 3, allowMultiplePerDay: false, scaleMin: 1, scaleMax: 10 },
  { name: 'Exercise',   type: 'BOOLEAN'  as const,                color: '#10b981', order: 4, allowMultiplePerDay: false },
]
