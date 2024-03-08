export type Vec2 = [number, number];
/** Functor map for `Vec2` */
export const map = (f: (x: number) => number, v: Vec2): Vec2 => [f(v[0]), f(v[1])]
/** Element-wise reduce */
export const reduce = (f: (prev: number, curr: number) => number, v: Vec2, ...vs: Vec2[]): Vec2 => [
  vs.reduce((p, x) => f(p, x[0]), v[0]),
  vs.reduce((p, x) => f(p, x[1]), v[1]),
]
/** Elementwise `u * v * ...` */
export const prod = (u: Vec2, ...vs: Vec2[]): Vec2 => reduce((x, y) => x*y, u, ...vs)
/** Elementwise `(((u / v) / ...) / ...)` */
export const div = (u: Vec2, ...vs: Vec2[]): Vec2 => reduce((x, y) => x/y, u, ...vs)
/** `u + v + ...` */
export const add = (u: Vec2, ...vs: Vec2[]): Vec2 => reduce((x, y) => x+y, u, ...vs)
/** `u - v - ...` */
export const sub = (u: Vec2, ...vs: Vec2[]): Vec2 => reduce((x, y) => x-y, u, ...vs)
/** Euclidian distance between u and v */
export const dist = (u: Vec2, v: Vec2): number => (u[0]-v[0])**2 + (u[1]-v[1])**2
const clamp1d = (xmin: number, x: number, xmax: number) => Math.max(xmin, Math.min(x, xmax))
const clamp2d = (vmin: Vec2, v: Vec2, vmax: Vec2): Vec2 =>
  [clamp1d(vmin[0], v[0], vmax[0]), clamp1d(vmin[1], v[1], vmax[1])]
/** Your usual 1d clamp */
export function clamp(xmin: number, x: number, xmax: number): number;
/** Elementwise clamp */
export function clamp(vmin: Vec2, v: Vec2, vmax: Vec2): Vec2
export function clamp(x, y, z): number | Vec2 {
  return typeof x === 'number' ? clamp1d(x, y, z) : clamp2d(x, y, z)
}