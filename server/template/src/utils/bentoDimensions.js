/**
 * Parse a bento string like "2x3" → { cols: 2, rows: 3 }
 */
export function parseBento(str) {
  const [w, h] = str.split('x').map(Number)
  return { cols: w || 1, rows: h || 1 }
}

/**
 * Format cols/rows into a bento string like "2x3"
 */
export function formatBento(cols, rows) {
  return `${cols}x${rows}`
}

/**
 * Clamp a bento size to fit within given column count
 */
export function clampBento(bento, maxColumns) {
  const { cols, rows } = parseBento(bento)
  return formatBento(Math.min(cols, maxColumns), rows)
}
