import { GripVertical, MessageCircle, LayoutGrid, Globe, Image, RotateCcw } from 'lucide-react'

const features = [
  {
    icon: GripVertical,
    title: 'Drag & Drop Editor',
    description: 'Rearrange cards with intuitive drag and drop. Resize with a click. No learning curve.',
  },
  {
    icon: MessageCircle,
    title: 'AI-Powered Chat',
    description: 'Let AI help you design your portfolio layout. Just describe what you want.',
  },
  {
    icon: LayoutGrid,
    title: 'Bento Grid Layout',
    description: 'Beautiful responsive grids that adapt to any screen size, automatically.',
  },
  {
    icon: Globe,
    title: 'One-Click Publish',
    description: 'Share your portfolio with a custom link. Go live in seconds, not hours.',
  },
  {
    icon: Image,
    title: 'Rich Content Cards',
    description: 'Add images, videos, text, and links. Crop, zoom, and position your media perfectly.',
  },
  {
    icon: RotateCcw,
    title: 'Undo / Redo',
    description: 'Never lose your work. Full history with keyboard shortcuts you already know.',
  },
]

export default function Features() {
  return (
    <section id="features" className="px-6 py-24 max-w-5xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 tracking-tight">
          Everything you need
        </h2>
        <p className="mt-4 text-zinc-500 text-lg">
          to create a standout portfolio
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="p-6 rounded-2xl border border-zinc-100 hover:border-zinc-200 hover:shadow-sm transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
              <feature.icon size={20} className="text-blue-500" />
            </div>
            <h3 className="font-semibold text-zinc-900">{feature.title}</h3>
            <p className="mt-2 text-sm text-zinc-500 leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
