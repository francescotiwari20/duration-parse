/**
 * Duration parsing and formatting for human-style shorthand like "2h30m".
 *
 * Design decisions, stated plainly:
 *
 * 1. A duration is a plain integer number of milliseconds. No class, no wrapper.
 *    This keeps it composable with any other time code a caller already has.
 *    The trade-off: callers must remember the unit. A single `Duration` type alias
 *    documents intent without imposing structure.
 *
 * 2. The parser is strict. "2h30m" works; "2 h 30 m" does not. Whitespace inside
 *    a duration is rejected because tolerating it creates ambiguity around compound
 *    forms ("1d 2h" — is that one duration or two?) and we choose not to support
 *    lists of durations. One value in, one duration out.
 *
 * 3. Units are ms, s, m, h, d. No weeks, months, or years — those are calendar
 *    concepts, not fixed durations. Supporting them would mean a clock dependency
 *    and non-deterministic output. Not worth it.
 *
 * 4. Empty input is a throw. Zero-length durations must be written explicitly as
 *    "0" or "0ms". Silent coercion of empty string to zero hides bugs in the
 *    caller and we refuse to do it.
 */

/**
 * A duration expressed as an integer number of milliseconds.
 * @typedef {number} Duration
 */

/**
 * Unit multipliers in milliseconds.
 * Lowercased keys so the parser is case-insensitive on the unit suffix.
 * Days are 24h exactly; we treat days as a fixed 86400000ms, not a calendar
 * concept, so "1d" is always the same regardless of when it is measured.
 * @type {Readonly<Record<string, number>>}
 */
const UNITS = Object.freeze({
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
});

/**
 * Ordered largest-first for formatting. Kept here, adjacent to UNITS, so that
 * any future change to UNITS forces a review of format ordering too.
 * @type {ReadonlyArray<{suffix: string, ms: number, name: string}>}
 */
const FORMAT_ORDER = Object.freeze([
  { suffix: 'd', ms: UNITS.d, name: 'd' },
  { suffix: 'h', ms: UNITS.h, name: 'h' },
  { suffix: 'm', ms: UNITS.m, name: 'm' },
  { suffix: 's', ms: UNITS.s, name: 's' },
  { suffix: 'ms', ms: UNITS.ms, name: 'ms' },
]);

/**
 * Parses a duration shorthand string like "2h30m" into milliseconds.
 *
 * Grammar (strict):
 *   duration  := segments
 *   segments  := segment ( segment )*
 *   segment   := digits unit
 *   digits    := one or more ASCII digits
 *   unit      := 'ms' | 's' | 'm' | 'h' | 'd'   (case-insensitive)
 *
 * A bare integer with no unit is interpreted as milliseconds. This is the one
 * tolerance we offer, because "60000" is a legitimate raw-ms input and forcing
 * users to write "60000ms" everywhere they have a number is worse than the risk.
 *
 * @param {string} input - The duration string.
 * @returns {number} Milliseconds as an integer.
 * @throws {TypeError} If input is not a string.
 * @throws {RangeError} If input is empty, contains whitespace, has an unknown
 *   unit, repeats a unit, or has out-of-order/non-digit characters.
 */
export function parseDuration(input) {
  if (typeof input !== 'string') {
    throw new TypeError(`Expected string, got ${typeof input}`);
  }
  if (input.length === 0) {
    throw new RangeError('Empty duration string');
  }
  // Reject any whitespace. Tolerating it invites list-of-durations ambiguity
  // and we deliberately do not support that. See module docstring decision 2.
  if (/\s/.test(input)) {
    throw new RangeError(`Whitespace not allowed in duration: ${JSON.stringify(input)}`);
  }

  // Split into (digits, unit) pairs. The regex requires a unit after each
  // number except optionally the trailing one. We instead require units on
  // all but a single bare number — handled by checking the whole string after.
  const segmentRe = /(\d+)(ms|s|m|h|d)/gi;
  let total = 0;
  const seen = new Set();
  let lastEnd = 0;
  let matchedAny = false;

  for (const match of input.matchAll(segmentRe)) {
    matchedAny = true;
    const start = match.index;
    if (start !== lastEnd) {
      // There are characters between segments (or at the front) that don't
      // match the grammar.
      throw new RangeError(`Unexpected characters in duration: ${JSON.stringify(input)}`);
    }
    const digits = match[1];
    const unitRaw = match[2].toLowerCase();
    if (seen.has(unitRaw)) {
      // "1h2h" is almost certainly a typo or a concatenation bug. Rejecting
      // duplicate units surfaces that immediately rather than summing silently.
      throw new RangeError(`Duplicate unit '${match[2]}' in duration: ${JSON.stringify(input)}`);
    }
    seen.add(unitRaw);
    total += Number(digits) * UNITS[unitRaw];
    lastEnd = start + match[0].length;
  }

  if (!matchedAny) {
    // No unit at all. Accept a single non-negative integer as raw ms.
    if (/^\d+$/.test(input)) {
      return Number(input);
    }
    throw new RangeError(`Unrecognized duration: ${JSON.stringify(input)}`);
  }

  if (lastEnd !== input.length) {
    // Trailing characters after the last valid segment.
    throw new RangeError(`Trailing characters in duration: ${JSON.stringify(input)}`);
  }

  // Guard against unsafe-integer results. Duration arithmetic beyond
  // Number.MAX_SAFE_INTEGER is not safe and we refuse to pretend otherwise.
  if (!Number.isSafeInteger(total)) {
    throw new RangeError(`Duration overflow: ${JSON.stringify(input)}`);
  }
  return total;
}

/**
 * Formats a duration in milliseconds into compact shorthand like "2h30m".
 *
 * - Zero formats as "0ms". We do not special-case zero to "0" because the bare
 *   number form is a parser tolerance, not the canonical representation, and
 *   consistency on output matters more than brevity.
 * - Negative durations format with a leading minus, e.g. "-1h30m".
 * - Milliseconds under 1000 are kept ("500ms"). We don't drop sub-second
 *   precision.
 *
 * @param {number} ms - Duration in milliseconds. Must be a finite number;
 *   non-finite values throw, fractional values are truncated toward zero.
 * @returns {string} Compact shorthand.
 * @throws {TypeError} If ms is not a number.
 * @throws {RangeError} If ms is non-finite (NaN, Infinity, -Infinity).
 */
export function formatDuration(ms) {
  if (typeof ms !== 'number') {
    throw new TypeError(`Expected number, got ${typeof ms}`);
  }
  if (!Number.isFinite(ms)) {
    throw new RangeError(`Duration must be finite, got ${ms}`);
  }
  // Truncate toward zero. A fractional ms is almost always upstream error,
  // but flooring negatives would be wrong (floor(-1.5) = -2), so we match
  // the sign-aware truncation that integer division would give.
  let remaining = Math.trunc(ms);
  if (remaining === 0) {
    return '0ms';
  }
  const negative = remaining < 0;
  if (negative) remaining = -remaining;

  const parts = [];
  for (const { suffix, ms: unitMs } of FORMAT_ORDER) {
    if (remaining >= unitMs) {
      const count = Math.floor(remaining / unitMs);
      parts.push(`${count}${suffix}`);
      remaining -= count * unitMs;
    }
  }
  // A non-zero input that rounds down to zero ms (e.g. 0.4 truncated) still
  // needs a representation. Fall back to 0ms for the sign-prefixed zero too,
  // but only when parts is empty — which only happens for |ms| < 1.
  if (parts.length === 0) {
    return '0ms';
  }
  return (negative ? '-' : '') + parts.join('');
}

/**
 * Convenience: parse then format. Useful when normalizing user input for
 * canonical storage — "90m" and "1h30m" both become "1h30m".
 *
 * @param {string} input - Duration shorthand.
 * @returns {string} Canonical formatted form.
 */
export function normalizeDuration(input) {
  return formatDuration(parseDuration(input));
}
