import { generateId } from '../../config.js'

// ── Action Types ─────────────────────────────────────────────────────────────
export const SET_MODE = 'SET_MODE'
export const SELECT_CARD = 'SELECT_CARD'
export const DESELECT_CARD = 'DESELECT_CARD'
export const ADD_CARD = 'ADD_CARD'
export const REMOVE_CARD = 'REMOVE_CARD'
export const RESIZE_CARD = 'RESIZE_CARD'
export const UPDATE_CARD_CONTENT = 'UPDATE_CARD_CONTENT'
export const SAVE = 'SAVE'
export const LOAD_STATE = 'LOAD_STATE'
export const SET_GRID_CONFIG = 'SET_GRID_CONFIG'
export const REORDER_CARDS = 'REORDER_CARDS'
export const ADD_SECTION = 'ADD_SECTION'
export const REMOVE_SECTION = 'REMOVE_SECTION'
export const UPDATE_SECTION_TITLE = 'UPDATE_SECTION_TITLE'
export const MOVE_CARD_TO_SECTION = 'MOVE_CARD_TO_SECTION'
export const REORDER_SECTIONS = 'REORDER_SECTIONS'
export const SET_BIO = 'SET_BIO'
export const CLEAR_BIO = 'CLEAR_BIO'
export const RESET_STATE = 'RESET_STATE'
export const RESTORE_SNAPSHOT = 'RESTORE_SNAPSHOT'

// ── Default card content ─────────────────────────────────────────────────────
const COLORS = ['#fde2e4', '#d3e4cd', '#dde1f8', '#fce8c3', '#c9e8f5', '#f5e6d3']
let colorIndex = 0
function nextColor() {
  return COLORS[colorIndex++ % COLORS.length]
}

export function makeCard(bento = '1x1', id, type = 'image') {
  return {
    id: id || generateId(),
    bento,
    content: {
      type,          // 'image' | 'video' | 'text'
      imageUrl: '',
      videoUrl: '',
      text: '',
      title: '',
      bgColor: nextColor(),
      textColor: '#374151',
      linkUrl: '',
      manualFontSize: null,   // null = auto-scale, number = locked px
      mediaScale: 1,          // zoom multiplier for image/video (1 = cover)
      mediaOffsetX: 0,        // horizontal pan offset in px from center
      mediaOffsetY: 0,        // vertical pan offset in px from center
      mediaRefW: null,        // card width (px) when the crop was last saved — used to scale offsets proportionally on resize
      mediaRefH: null,        // card height (px) when the crop was last saved
      isCompressed: false,    // true after the Compress action has run on this card
    },
  }
}

export function makeSection(title = 'Untitled Section') {
  return {
    id: generateId(),
    title,
    cards: [],
  }
}

// ── Initial State ─────────────────────────────────────────────────────────────
export const initialState = {
  mode: 'edit',
  selectedCardId: null,
  isDirty: false,
  gridConfig: {
    columns: 4,
    cellGap: 8,
    aspectRatio: 1,
  },
  sections: [makeSection('Section 1')],
  bio: null, // { avatar: '', name: '', description: '', blocks: [{ id, heading, body }] }
  lastSaved: null,
}

// ── Reducer ───────────────────────────────────────────────────────────────────
export function reducer(state, action) {
  switch (action.type) {

    case SET_MODE:
      return {
        ...state,
        mode: action.payload,
        selectedCardId: null,
      }

    case SELECT_CARD:
      return { ...state, selectedCardId: action.payload }

    case DESELECT_CARD:
      return { ...state, selectedCardId: null }

    case ADD_CARD: {
      const { sectionId, id, bento, insertIndex } = action.payload
      const newCard = makeCard(bento || '1x1', id)
      return {
        ...state,
        sections: state.sections.map(s => {
          if (s.id !== sectionId) return s
          if (insertIndex != null) {
            const next = [...s.cards]
            next.splice(insertIndex, 0, newCard)
            return { ...s, cards: next }
          }
          return { ...s, cards: [...s.cards, newCard] }
        }),
        selectedCardId: newCard.id,
        isDirty: true,
      }
    }

    case REMOVE_CARD: {
      const cardId = action.payload
      return {
        ...state,
        sections: state.sections.map(s => ({
          ...s,
          cards: s.cards.filter(c => c.id !== cardId),
        })),
        selectedCardId: state.selectedCardId === cardId ? null : state.selectedCardId,
        isDirty: true,
      }
    }

    case RESIZE_CARD:
      return {
        ...state,
        sections: state.sections.map(s => ({
          ...s,
          cards: s.cards.map(c =>
            c.id === action.payload.id ? { ...c, bento: action.payload.bento } : c
          ),
        })),
        isDirty: true,
      }

    case UPDATE_CARD_CONTENT:
      return {
        ...state,
        sections: state.sections.map(s => ({
          ...s,
          cards: s.cards.map(c => {
            if (c.id !== action.payload.id) return c
            const updates = action.payload.updates
            // If a new media URL is being set (and isCompressed is not explicitly
            // included in the same update), reset the compression flag so the
            // Compress button knows this card needs re-processing.
            const urlChanged =
              !('isCompressed' in updates) && (
                ('imageUrl' in updates && updates.imageUrl !== c.content.imageUrl) ||
                ('videoUrl' in updates && updates.videoUrl !== c.content.videoUrl)
              )
            return {
              ...c,
              content: {
                ...c.content,
                ...updates,
                ...(urlChanged ? { isCompressed: false } : {}),
              },
            }
          }),
        })),
        isDirty: true,
      }

    case SAVE:
      return { ...state, isDirty: false, lastSaved: new Date().toISOString() }

    case LOAD_STATE: {
      // Support legacy flat cards array by wrapping in a single section
      let sections = action.payload.sections
      if (!sections && action.payload.cards) {
        sections = [{ id: 'section-legacy', title: 'Section 1', cards: action.payload.cards }]
      }
      return {
        ...state,
        sections: sections ?? state.sections,
        bio: action.payload.bio ?? state.bio,
        gridConfig: action.payload.gridConfig ?? state.gridConfig,
        isDirty: false,
        lastSaved: action.payload.savedAt ?? null,
      }
    }

    case SET_GRID_CONFIG:
      return {
        ...state,
        gridConfig: { ...state.gridConfig, ...action.payload },
        isDirty: true,
      }

    case REORDER_CARDS: {
      const { sectionId, fromIndex, toIndex } = action.payload
      if (fromIndex === toIndex) return state
      return {
        ...state,
        sections: state.sections.map(s => {
          if (s.id !== sectionId) return s
          const next = [...s.cards]
          const [moved] = next.splice(fromIndex, 1)
          next.splice(toIndex, 0, moved)
          return { ...s, cards: next }
        }),
        isDirty: true,
      }
    }

    case ADD_SECTION: {
      const newSection = makeSection(action.payload?.title || 'Untitled Section')
      const insertIndex = action.payload?.insertIndex
      if (insertIndex != null) {
        const next = [...state.sections]
        next.splice(insertIndex, 0, newSection)
        return { ...state, sections: next, isDirty: true }
      }
      return {
        ...state,
        sections: [...state.sections, newSection],
        isDirty: true,
      }
    }

    case REMOVE_SECTION: {
      const sectionId = action.payload
      // Check if any card in this section is selected
      const section = state.sections.find(s => s.id === sectionId)
      const selectedInSection = section?.cards.some(c => c.id === state.selectedCardId)
      return {
        ...state,
        sections: state.sections.filter(s => s.id !== sectionId),
        selectedCardId: selectedInSection ? null : state.selectedCardId,
        isDirty: true,
      }
    }

    case MOVE_CARD_TO_SECTION: {
      const { cardId, fromSectionId, toSectionId, toIndex } = action.payload
      if (fromSectionId === toSectionId) return state
      const fromSection = state.sections.find(s => s.id === fromSectionId)
      const card = fromSection?.cards.find(c => c.id === cardId)
      if (!card) return state
      return {
        ...state,
        sections: state.sections.map(s => {
          if (s.id === fromSectionId) {
            return { ...s, cards: s.cards.filter(c => c.id !== cardId) }
          }
          if (s.id === toSectionId) {
            const next = [...s.cards]
            const insertAt = toIndex != null ? toIndex : next.length
            next.splice(insertAt, 0, card)
            return { ...s, cards: next }
          }
          return s
        }),
        isDirty: true,
      }
    }

    case REORDER_SECTIONS: {
      const { fromIndex, toIndex } = action.payload
      if (fromIndex === toIndex) return state
      const next = [...state.sections]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return { ...state, sections: next, isDirty: true }
    }

    case UPDATE_SECTION_TITLE:
      return {
        ...state,
        sections: state.sections.map(s =>
          s.id === action.payload.id ? { ...s, title: action.payload.title } : s
        ),
        isDirty: true,
      }

    case SET_BIO:
      return {
        ...state,
        bio: { ...state.bio, ...action.payload },
        isDirty: true,
      }

    case CLEAR_BIO:
      return {
        ...state,
        bio: null,
        isDirty: true,
      }

    case RESET_STATE:
      return {
        ...state,
        sections: [],
        bio: null,
        selectedCardId: null,
        isDirty: true,
      }

    case RESTORE_SNAPSHOT:
      return {
        ...state,
        sections: action.payload.sections,
        bio: action.payload.bio ?? null,
        isDirty: true,
      }

    default:
      return state
  }
}
