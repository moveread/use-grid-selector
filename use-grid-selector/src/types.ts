import { Vec2 } from "./util/vectors.js"

export type Rectangle = {
  tl: Vec2,
  size: Vec2
}

export type Pads = { l: number, r: number, t: number, b: number }
export type Template = {
  rows: number[], cols: number[]
}