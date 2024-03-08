import { Vec2 } from "./vectors.js";

/** `[[tl, bl], [tr, br]]`
 * - I.e. `(0, 0) = tl, (1, 0) = tr, (0, 1) = bl, (1, 1) = br` */
export type RectCorners<T> = [[T, T], [T, T]]

/** Your usual functor map */
export const map = <T, U>(xxs: RectCorners<T>, f: (x: T, idx: Vec2) => U): RectCorners<U> => xxs.map(
  (xs, i) => xs.map((x, j) => f(x, [i, j]))
) as RectCorners<U>

export const copy = <T>(xs: RectCorners<T>): RectCorners<T> => [[...xs[0]], [...xs[1]]]

type PosUpdates = RectCorners<{ left?: number, top?: number }>
/** Update `corners` to keep a rectangle whilst updating `corners[idx] <- to`
 * - Returns updates for `fabric.Object.set`
 * - Opposite corner stays the same
 * - Corner with same x gets x updated
 * - Corner with same y gets y updated
*/
export function move([i, j]: Vec2, [left, top]: Vec2): PosUpdates {
  const updates: PosUpdates = [[{}, {}], [{}, {}]]
  updates[i][j] = { left, top }
  updates[1-i][j] = { top }
  updates[i][1-j] = { left }
  return updates
}