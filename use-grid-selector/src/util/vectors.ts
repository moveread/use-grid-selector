export type Vec2 = [number, number];

const clamp1d = (xmin: number, x: number, xmax: number) => Math.max(xmin, Math.min(x, xmax))

export const map = (v: Vec2, f: (x: number) => number): Vec2 => [f(v[0]), f(v[1])]

/** Elementwise u * v */
export const prod = (u: Vec2, v: Vec2): Vec2 => [u[0]*v[0], u[1]*v[1]];
/** Elementwise u / v */
export const div = (u: Vec2, v: Vec2): Vec2 => [u[0]/v[0], u[1]/v[1]];
/** u + v */
export const add = (u: Vec2, v: Vec2): Vec2 => [u[0]+v[0], u[1]+v[1]];
/** u - v */
export const sub = (u: Vec2, v: Vec2): Vec2 => [u[0]-v[0], u[1]-v[1]];
export const dist = (u: Vec2, v: Vec2): number => (u[0]-v[0])**2 + (u[1]-v[1])**2
export const clamp = (v: Vec2, vmin: Vec2, vmax: Vec2): Vec2 =>
  [clamp1d(vmin[0], v[0], vmax[0]), clamp1d(vmin[1], v[1], vmax[1])]