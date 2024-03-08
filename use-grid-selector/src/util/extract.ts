import { Mat, Rect } from 'use-cv'
import { Rectangle } from '../types.js'
import * as vec from './vectors.js'

export type Paddings = {
  l: number, r: number, t: number, b: number
}

export const defaultPads: Paddings = {
  l: 0.1, r: 0.1, t: 0.1, b: 0.2
}

/** Extracts ROI defined in `coords` from `img`, adding `paddings` around */
export function roi(img: Mat, coords: Rectangle, paddings?: Partial<Paddings>): Mat {
  const { tl: [x, y], size: [w, h] } = coords
  const { l, r, t, b } = { ...defaultPads, ...paddings }
  const rect: Rectangle = {
    tl: vec.map(Math.round, [x-l*w, y-t*h]), // just in case CV don't like floats
    size: vec.map(Math.round, [(1+l+r)*w, (1+t+b)*h])
  }
  const clippedRect = clip(rect, img.cols, img.rows)
  return img.roi(asCvRect(clippedRect)).clone() // IMPORTANT: must clone to make the data continuous!
}

export function asCvRect({ tl, size }: Rectangle): Rect {
  return { x: tl[0], y: tl[1], width: size[0], height: size[1] } as Rect
}

/** Clip `coords` to be within `[0, 0]` and `[width, height]` */
export function clip({ tl, size }: Rectangle, width: number, height: number): Rectangle {
  const [x, y] = vec.clamp([0, 0], tl, [width, height])
  const maxSize: vec.Vec2 = [width-x-1, height-y-1]
  const clippedSize = vec.clamp([0, 0], size, maxSize)
  return {
    tl: [x, y],
    size: clippedSize
  }
}