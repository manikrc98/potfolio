import { Trash2, GripVertical } from 'lucide-react'
import { UPDATE_SECTION_TITLE } from '../store/cardStore.js'

export default function SectionHeader({ section, isEditMode, dispatch, onDeleteRequest, onDragStart }) {
  return (
    <div className="relative flex items-center gap-1 mb-2 group/section">
      {isEditMode && (
        <div
          className="absolute -left-6 top-1/2 -translate-y-1/2 p-1 text-zinc-300 hover:text-zinc-500
            cursor-grab active:cursor-grabbing opacity-0 group-hover/section:opacity-100
            transition-opacity touch-none select-none"
          onPointerDown={onDragStart}
          title="Drag to reorder"
        >
          <GripVertical size={16} />
        </div>
      )}

      {isEditMode ? (
        <input
          className="text-lg font-semibold bg-transparent outline-none border-b-2 border-transparent
            focus:border-blue-300 transition-colors px-1 py-0.5 flex-1 min-w-0
            placeholder:text-zinc-300"
          value={section.title}
          onChange={e =>
            dispatch({
              type: UPDATE_SECTION_TITLE,
              payload: { id: section.id, title: e.target.value },
            })
          }
          placeholder="Section title…"
        />
      ) : (
        <h2 className="text-lg font-semibold px-1 py-0.5 flex-1 border-b-2 border-transparent">{section.title}</h2>
      )}

      {isEditMode && (
        <button
          onClick={() => onDeleteRequest(section.id)}
          className="p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50
            transition-colors opacity-0 group-hover/section:opacity-100"
          title="Delete section"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  )
}
