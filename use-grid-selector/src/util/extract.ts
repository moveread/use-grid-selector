import { Model } from 'scoresheet-models'
import { Rectangle } from '../types'
import { Mat, Rect } from 'use-cv'

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
  const paddedRect = {
    x: x-l*w,
    y: y-t*h,
    width: (1+l+r)*w,
    height: (1+t+b)*h
  } as Rect
  return img.roi(paddedRect).clone() // IMPORTANT: must clone to make the data continuous!
}