import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseDuration, formatDuration, normalizeDuration } from '../src/core.js';

describe('parseDuration', () => {
  it('parses a single unit', () => {
    assert.equal(parseDuration('30m'), 30 * 60_000);
  });

  it('parses a compound duration', () => {
    assert.equal(parseDuration('2h30m'), 2 * 3_600_000 + 30 * 60_000);
  });

  it('parses all supported units combined', () => {
    assert.equal(
      parseDuration('1d2h3m4s5ms'),
      1 * 86_400_000 + 2 * 3_600_000 + 3 * 60_000 + 4 * 1000 + 5,
    );
  });

  it('accepts case-insensitive units', () => {
    assert.equal(parseDuration('2H30M'), parseDuration('2h30m'));
  });

  it('accepts a bare integer as milliseconds', () => {
    assert.equal(parseDuration('5000'), 5000);
    assert.equal(parseDuration('0'), 0);
  });

  it('accepts an explicit zero', () => {
    assert.equal(parseDuration('0ms'), 0);
  });

  it('rejects empty input', () => {
    assert.throws(() => parseDuration(''), RangeError);
  });

  it('rejects whitespace inside the string', () => {
    assert.throws(() => parseDuration('2h 30m'), RangeError);
    assert.throws(() => parseDuration(' 2h30m'), RangeError);
    assert.throws(() => parseDuration('2h30m '), RangeError);
  });

  it('rejects unknown units', () => {
    assert.throws(() => parseDuration('2w'), RangeError);
    assert.throws(() => parseDuration('1y'), RangeError);
  });

  it('rejects duplicate units', () => {
    assert.throws(() => parseDuration('1h2h'), RangeError);
  });

  it('rejects trailing garbage', () => {
    assert.throws(() => parseDuration('2h30m!'), RangeError);
    assert.throws(() => parseDuration('2hxyz'), RangeError);
  });

  it('rejects non-string input', () => {
    assert.throws(() => parseDuration(123), TypeError);
    assert.throws(() => parseDuration(null), TypeError);
    assert.throws(() => parseDuration(undefined), TypeError);
  });
});

describe('formatDuration', () => {
  it('formats zero', () => {
    assert.equal(formatDuration(0), '0ms');
  });

  it('formats a single-unit duration', () => {
    assert.equal(formatDuration(5_000), '5s');
  });

  it('formats a compound duration', () => {
    assert.equal(formatDuration(2 * 3_600_000 + 30 * 60_000), '2h30m');
  });

  it('formats the full example', () => {
    const ms = 1 * 86_400_000 + 2 * 3_600_000 + 3 * 60_000 + 4 * 1000 + 5;
    assert.equal(formatDuration(ms), '1d2h3m4s5ms');
  });

  it('keeps sub-second milliseconds', () => {
    assert.equal(formatDuration(500), '500ms');
  });

  it('drops a leading zero unit', () => {
    // 30m should not show "0h".
    assert.equal(formatDuration(30 * 60_000), '30m');
  });

  it('formats negative durations', () => {
    assert.equal(formatDuration(-(2 * 3_600_000 + 30 * 60_000)), '-2h30m');
  });

  it('truncates fractional milliseconds toward zero', () => {
    assert.equal(formatDuration(1500.9), '1s500ms');
    assert.equal(formatDuration(-1500.9), '-1s500ms');
  });

  it('rejects non-number input', () => {
    assert.throws(() => formatDuration('1000'), TypeError);
    assert.throws(() => formatDuration(null), TypeError);
  });

  it('rejects non-finite values', () => {
    assert.throws(() => formatDuration(NaN), RangeError);
    assert.throws(() => formatDuration(Infinity), RangeError);
    assert.throws(() => formatDuration(-Infinity), RangeError);
  });
});

describe('normalizeDuration', () => {
  it('normalizes equivalent forms', () => {
    assert.equal(normalizeDuration('90m'), '1h30m');
    assert.equal(normalizeDuration('1h30m'), '1h30m');
  });

  it('normalizes a bare integer', () => {
    assert.equal(normalizeDuration('90000'), '1m30s');
  });
});
