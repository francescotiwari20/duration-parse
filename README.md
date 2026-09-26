# duration-parse

Convert shorthand durations like `2h30m` to and from milliseconds.

```js
import { parseDuration, formatDuration, normalizeDuration } from './src/index.js';

const ms = parseDuration('2h30m');     // 9000000
const text = formatDuration(ms);       // "2h30m"
const canon = normalizeDuration('90m'); // "1h30m"
```

## Why

Existing duration libraries tend to either overreach — pulling in calendar
concepts like months and years, which are not fixed lengths — or under-deliver,
returning `NaN` on input they don't like. This one does exactly one thing:
parses the fixed-unit shorthand `ms`, `s`, `m`, `h`, `d` into an integer number
of milliseconds, and formats that back into the same compact notation. A day is
always `86_400_000` ms. There is no clock, no timezone, no locale.

The trade-off: you cannot use this library to express "one month from now".
That is the point.

## Edge cases

- **Whitespace is rejected.** `2h 30m` throws. If you have user input that may
  contain spaces, strip them yourself first.
- **Duplicate units throw.** `1h2h` is rejected rather than summed, because it
  almost always indicates a bug in the caller.
- **A bare integer is treated as milliseconds.** `parseDuration('5000')` returns
  `5000`. This is the one tolerance the parser offers.
- **Empty string throws**, not silently zero. Write `0` or `0ms` if you mean
  zero.
- **Fractional milliseconds are truncated toward zero** on format, not floored,
  so that negatives behave symmetrically.

## Exports

- `parseDuration(input: string): number` — parse shorthand to ms.
- `formatDuration(ms: number): string` — format ms to shorthand.
- `normalizeDuration(input: string): string` — parse then format.

## Run the tests

```
node --test test/
```
