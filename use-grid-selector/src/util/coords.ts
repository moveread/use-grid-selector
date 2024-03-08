import { fabric } from "fabric"
import { Vec2, prod, add, clamp } from "./vectors.js"

export const width = (obj: fabric.Object) => obj.get('width')! * obj.get('scaleX')!
export const height = (obj: fabric.Object) => obj.get('height')! * obj.get('scaleY')!
export const size = (obj: fabric.Object): Vec2 => [width(obj), height(obj)]
export const tl = (obj: fabric.Object): Vec2 => [obj.get('left')!, obj.get('top')!]


/** Clamps `p` to be inside `img` */
export function clamped(p: Vec2, img: fabric.Image): Vec2 {
  const pmin = tl(img)
  const pmax = add(pmin, size(img))
  return clamp(p, pmin, pmax)
}

/** Maps `(x, y) in ([0, 1], [0, 1])` to `([obj.left, obj.right], [obj.top, obj.bot])`. I.e:
 * 1. Rescales to `img.size`
 * 2. Translates to `img.topleft`
 */
export function rescale(p: Vec2, img: fabric.Image): Vec2 {
  const p_scaled = prod(p, size(img))
  return add(p_scaled, tl(img))
}