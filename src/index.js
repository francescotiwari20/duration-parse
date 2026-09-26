/**
 * Public entry point for the duration-parse library.
 *
 * Re-exports the parsing and formatting surface. Keeping this in its own file
 * means callers can `import { parseDuration } from 'duration-parse'` and the
 * bundler sees a single, stable root.
 */

export { parseDuration, formatDuration, normalizeDuration } from './core.js';
