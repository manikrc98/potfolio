const examples = [
  {
    label: 'Creative Portfolio',
    gradient: 'from-violet-100 via-purple-50 to-fuchsia-100',
    gridItems: [
      'col-span-2 row-span-2 bg-violet-200/60',
      'bg-fuchsia-200/60',
      'bg-purple-200/60',
      'col-span-2 bg-violet-100/80',
    ],
  },
  {
    label: 'Developer Showcase',
    gradient: 'from-cyan-100 via-sky-50 to-blue-100',
    gridItems: [
      'bg-cyan-200/60',
      'col-span-2 bg-sky-200/60',
      'col-span-2 row-span-2 bg-blue-200/60',
      'bg-cyan-100/80',
    ],
  },
  {
    label: 'Design Portfolio',
    gradient: 'from-amber-100 via-orange-50 to-rose-100',
    gridItems: [
      'col-span-3 bg-amber-200/60',
      'bg-rose-200/60',
      'bg-orange-200/60',
      'col-span-2 bg-amber-100/80',
    ],
  },
]

export default function Showcase() {
  return (
    <section id="showcase" className="px-6 py-24 max-w-5xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 tracking-tight">
          Made with Potfolio
        </h2>
        <p className="mt-4 text-zinc-500 text-lg">
          See what's possible
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {examples.map((example) => (
          <div key={example.label} className="group cursor-pointer">
            <div className={`rounded-2xl overflow-hidden border border-zinc-200 shadow-sm group-hover:shadow-md transition-shadow bg-gradient-to-br ${example.gradient} aspect-[4/3] p-4`}>
              <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-2">
                {example.gridItems.map((classes, i) => (
                  <div key={i} className={`rounded-lg ${classes}`} />
                ))}
              </div>
            </div>
            <p className="mt-3 text-sm text-zinc-500 text-center font-medium group-hover:text-zinc-700 transition-colors">
              {example.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
