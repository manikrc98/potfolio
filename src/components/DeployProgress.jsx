const steps = [
  'Creating repository',
  'Pushing template files',
  'Deploying to GitHub Pages',
  'Configuring custom domain',
]

/**
 * @param {{ completedSteps: number, error?: string|null }} props
 * completedSteps: how many steps are fully done (0–4)
 * The next step after completedSteps is shown as in-progress (spinner).
 */
export default function DeployProgress({ completedSteps = 0, error = null }) {
  // If there's an error, the failed step is the one after completedSteps
  const failedStep = error ? completedSteps : -1

  return (
    <div className="text-center">
      {!error && (
        <div className="w-12 h-12 mx-auto mb-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      )}
      {error && (
        <div className="w-12 h-12 mx-auto mb-8 rounded-full bg-red-50 flex items-center justify-center">
          <span className="text-red-500 text-xl">!</span>
        </div>
      )}
      <h2 className="text-xl font-bold text-zinc-900 mb-6">
        {error ? 'Something went wrong' : 'Setting up your portfolio...'}
      </h2>

      <div className="max-w-xs mx-auto space-y-3 text-left">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center gap-3">
            {i < completedSteps ? (
              // Completed
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : i === failedStep ? (
              // Failed
              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            ) : i === completedSteps && !error ? (
              // In progress
              <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
            ) : (
              // Pending
              <div className="w-5 h-5 rounded-full border-2 border-zinc-200 shrink-0" />
            )}
            <span className={`text-sm ${
              i === failedStep ? 'text-red-600 font-medium' :
              i <= completedSteps && !error ? 'text-zinc-800' :
              i < completedSteps ? 'text-zinc-800' : 'text-zinc-400'
            }`}>
              {step}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-6 text-sm text-red-500 max-w-xs mx-auto">{error}</p>
      )}
    </div>
  )
}
