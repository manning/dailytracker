import { parseDuration, formatDuration, naturalUnitFromMetricUnit } from '../duration'

describe('parseDuration', () => {
  describe('colon shorthand', () => {
    test('"5:12" is 5 minutes 12 seconds', () => {
      expect(parseDuration('5:12')).toBe(5 * 60 + 12)
    })
    test('"5:30" is 5 minutes 30 seconds (5.5 minutes)', () => {
      expect(parseDuration('5:30')).toBe(330)
    })
    test('"5:12:0" is 5 hours 12 minutes', () => {
      expect(parseDuration('5:12:0')).toBe(5 * 3600 + 12 * 60)
    })
    test('"5:12:30" is 5h 12m 30s', () => {
      expect(parseDuration('5:12:30')).toBe(5 * 3600 + 12 * 60 + 30)
    })
    test('"0:45" is 45 seconds', () => {
      expect(parseDuration('0:45')).toBe(45)
    })
    test('natural unit does not change colon interpretation', () => {
      expect(parseDuration('5:12', 'hours')).toBe(5 * 60 + 12)
      expect(parseDuration('5:12', 'seconds')).toBe(5 * 60 + 12)
    })
  })

  describe('unit-bearing input', () => {
    test('"5h 12m" is 5 hours 12 minutes', () => {
      expect(parseDuration('5h 12m')).toBe(5 * 3600 + 12 * 60)
    })
    test('"5h 12 mins" with verbose unit', () => {
      expect(parseDuration('5h 12 mins')).toBe(5 * 3600 + 12 * 60)
    })
    test('"5 hours 12 minutes"', () => {
      expect(parseDuration('5 hours 12 minutes')).toBe(5 * 3600 + 12 * 60)
    })
    test('"45m"', () => {
      expect(parseDuration('45m')).toBe(45 * 60)
    })
    test('"90s"', () => {
      expect(parseDuration('90s')).toBe(90)
    })
    test('"5h 30m 15s"', () => {
      expect(parseDuration('5h 30m 15s')).toBe(5 * 3600 + 30 * 60 + 15)
    })
    test('"7h" with bare hours-only input', () => {
      expect(parseDuration('7h')).toBe(7 * 3600)
    })
    test('case-insensitive units', () => {
      expect(parseDuration('5H 12M')).toBe(5 * 3600 + 12 * 60)
    })
    test('decimal in unit-bearing', () => {
      expect(parseDuration('1.5h')).toBe(5400)
    })
  })

  describe('plain numbers', () => {
    test('"5.2" with hours unit is 5.2 hours', () => {
      expect(parseDuration('5.2', 'hours')).toBeCloseTo(5.2 * 3600)
    })
    test('"5.2" with minutes unit (default) is 5.2 minutes', () => {
      expect(parseDuration('5.2')).toBeCloseTo(5.2 * 60)
    })
    test('"5.2" with seconds unit is 5.2 seconds', () => {
      expect(parseDuration('5.2', 'seconds')).toBeCloseTo(5.2)
    })
  })

  describe('invalid input', () => {
    test('empty string', () => {
      expect(parseDuration('')).toBeNull()
      expect(parseDuration('   ')).toBeNull()
    })
    test('non-numeric', () => {
      expect(parseDuration('abc')).toBeNull()
    })
    test('mismatched colons', () => {
      expect(parseDuration('1:2:3:4')).toBeNull()
    })
    test('out-of-order units', () => {
      // "5m 2h" violates h-then-m-then-s ordering — should fail
      expect(parseDuration('5m 2h')).toBeNull()
    })
  })
})

describe('formatDuration', () => {
  test('zero with various natural units', () => {
    expect(formatDuration(0, 'hours')).toBe('0h')
    expect(formatDuration(0, 'minutes')).toBe('0m')
    expect(formatDuration(0, 'seconds')).toBe('0s')
  })
  test('roundtrip 5h 12m', () => {
    expect(formatDuration(5 * 3600 + 12 * 60)).toBe('5h 12m')
  })
  test('roundtrip 5m 30s', () => {
    expect(formatDuration(330)).toBe('5m 30s')
  })
  test('roundtrip with all three parts', () => {
    expect(formatDuration(3600 + 120 + 5)).toBe('1h 2m 5s')
  })
  test('rounds sub-second', () => {
    expect(formatDuration(5.4)).toBe('5s')
    expect(formatDuration(59.9)).toBe('1m')
  })
})

describe('naturalUnitFromMetricUnit', () => {
  test.each([
    ['hours',   'hours'],
    ['hour',    'hours'],
    ['hr',      'hours'],
    ['hrs',     'hours'],
    ['h',       'hours'],
    ['minutes', 'minutes'],
    ['min',     'minutes'],
    ['m',       'minutes'],
    ['seconds', 'seconds'],
    ['sec',     'seconds'],
    ['s',       'seconds'],
    [null,      'minutes'],
    ['',        'minutes'],
    ['banana',  'minutes'],
  ] as const)('"%s" -> %s', (input, expected) => {
    expect(naturalUnitFromMetricUnit(input as any)).toBe(expected)
  })
})
