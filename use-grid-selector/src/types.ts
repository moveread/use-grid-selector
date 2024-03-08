import { Vec2 } from "./util/vectors"

export type Coords = {
  tl: Vec2,
  size: Vec2
}

export type Pads = { l: number, r: number, t: number, b: number }
export type Template = {
  rows: number[], cols: number[]
}