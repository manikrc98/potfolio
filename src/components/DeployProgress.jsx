import { useEffect, useState } from 'react'

const steps = [
  'Creating repository',
  'Pushing template files',
  'Enabling GitHub Pages',
  'Triggering deployment',
]

export default function DeployProgress() {
  const [activeStep, setActiveStep] = useState(0)

  // Simulate step progression for visual feedback
  useEffect(() => {
    const timers = steps.map((_, i) =>
      setTimeout(() => setActiveStep(i), i * 2500)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="text-center">
      <div className="w-12 h-12 mx-auto mb-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <h2 className="text-xl font-bold text-zinc-900 mb-6">Setting up your portfolio...</h2>

      <div className="max-w-xs mx-auto space-y-3 text-left">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center gap-3">
            {i < activeStep ? (
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : i === activeStep ? (
              <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-zinc-200 shrink-0" />
            )}
            <span className={`text-sm ${i <= activeStep ? 'text-zinc-800' : 'text-zinc-400'}`}>
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
