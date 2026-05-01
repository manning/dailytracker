import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

export default function DataPage() {
  // Export state
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo,   setExportTo]   = useState('')
  const [exporting,  setExporting]  = useState(false)
  const [exportErr,  setExportErr]  = useState('')

  // Import state
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing,    setImporting]    = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; warnings: string[] } | null>(null)
  const [importErr,    setImportErr]    = useState('')

  async function handleExport() {
    setExporting(true)
    setExportErr('')
    try {
      const blob = await api.csv.export({
        from: exportFrom || undefined,
        to:   exportTo   || undefined,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dailytracker-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportErr(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    setImportErr('')
    try {
      const text = await file.text()
      const result = await api.csv.import(text)
      setImportResult(result)
    } catch (err) {
      setImportErr(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-4">
        <Link to="/" className="text-gray-400 hover:text-gray-600 text-lg">←</Link>
        <h1 className="text-xl font-semibold text-gray-900">Import / Export</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* Export */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Export CSV</h2>
            <p className="text-sm text-gray-500 mt-1">
              Downloads all your entries as a CSV file. Non-boolean metrics get their own
              column; all tags are combined into a single pipe-delimited column.
              Leave dates blank to export everything.
            </p>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">From (optional)</label>
              <input
                type="date"
                value={exportFrom}
                onChange={e => setExportFrom(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">To (optional)</label>
              <input
                type="date"
                value={exportTo}
                onChange={e => setExportTo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {exportErr && <p className="text-sm text-red-600">{exportErr}</p>}

          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            {exporting ? 'Preparing download…' : 'Export CSV'}
          </button>
        </section>

        {/* Import */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Import CSV</h2>
            <p className="text-sm text-gray-500 mt-1">
              Import from a file in the exported format. Column names must match your
              existing metric names (case-insensitive). The <code className="font-mono text-xs bg-gray-100 px-1 rounded">tags</code> column
              should contain pipe-delimited tag names. Existing entries for the same metric
              and day are skipped — safe to re-import.
            </p>
          </div>

          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {importing ? (
              <p className="text-sm text-gray-500">Importing…</p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700">Click to choose a CSV file</p>
                <p className="text-xs text-gray-400 mt-1">or drag and drop</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleImport}
              className="hidden"
            />
          </div>

          {importErr && <p className="text-sm text-red-600">{importErr}</p>}

          {importResult && (
            <div className="rounded-xl border border-gray-200 p-4 space-y-2">
              <div className="flex gap-6 text-sm">
                <span><span className="font-semibold text-green-600">{importResult.created}</span> entries created</span>
                <span><span className="font-semibold text-gray-500">{importResult.skipped}</span> skipped (already exist)</span>
              </div>
              {importResult.warnings.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-amber-600 mb-1">Warnings</p>
                  <ul className="space-y-0.5">
                    {importResult.warnings.map((w, i) => (
                      <li key={i} className="text-xs text-gray-500">{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

      </main>
    </div>
  )
}
