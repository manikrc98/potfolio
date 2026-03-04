import { UserPlus, Palette, Share2 } from 'lucide-react'

const steps = [
  {
    number: 1,
    icon: UserPlus,
    title: 'Sign Up',
    description: 'Create your account in seconds with Google. No credit card needed.',
  },
  {
    number: 2,
    icon: Palette,
    title: 'Design',
    description: 'Drag and drop cards, add your content, and customize every detail.',
  },
  {
    number: 3,
    icon: Share2,
    title: 'Share',
    description: 'Publish your portfolio and share your unique link with the world.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="px-6 py-24 bg-zinc-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 tracking-tight">
            How it works
          </h2>
          <p className="mt-4 text-zinc-500 text-lg">
            Three steps to your new portfolio
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
          {steps.map((step) => (
            <div key={step.number} className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <step.icon size={24} />
                </div>
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border-2 border-blue-500 text-blue-500 text-xs font-bold flex items-center justify-center">
                  {step.number}
                </span>
              </div>
              <h3 className="mt-6 font-semibold text-zinc-900 text-lg">{step.title}</h3>
              <p className="mt-2 text-zinc-500 text-sm max-w-xs leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
