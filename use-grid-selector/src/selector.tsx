import { RefCallback, SVGProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fabric } from 'fabric'
import { useFabric } from 'use-fabric'
import * as obj from './util/coords';
import * as vec from './util/vectors';
import { Vec2 } from './util/vectors';
import { Coords, Pads, Template } from './types';
import { argminBy2 } from './util/arrays';
import * as crn from './util/corners';
import { RectCorners } from './util/corners';
import { gridUrl } from './util/SvgGrid';
import { managedPromise } from 'promises-tk'

export type CornerOptions = Omit<fabric.ICircleOptions, 'left' | 'top' | 'originX' | 'originY' | 'hasControls'> & {
  radius?: number, selectedRadius?: number
}
const corner = (v: Vec2, params?: CornerOptions) => new fabric.Circle({
  left: v[0], top: v[1], originX: 'center', originY: 'center',
  hasControls: false, selectable: false, ...params
})

export type Hook = {
  ref: RefCallback<HTMLCanvasElement>
  coords(): Coords
  animate: { loaded: false } | ({
    loaded: true
  } & Animate)
}
export type Animate = (coords: Partial<Coords>, config?: AnimationConfig) => Promise<void>
export type AnimationConfig = Omit<fabric.IAnimationOptions, 'onChange' | 'onComplete'>

export type GridConfig = {
  size?: Vec2
  line: SVGProps<SVGLineElement>
}

export type Config = {
  pads?: Pads
  startCoords?: Coords
  grid?: GridConfig
  canvas?: fabric.ICanvasOptions
  cornerOptions?: CornerOptions
  templateOptions?: fabric.IImageOptions
  topBias?: number
  leftBias?: number
  whichCorners?: 'all' | 'main-diagonal' | 'secondary-diagonal'
}
const defaultRadius = 10
const defaultSelectedRadius = 30
const defaultCfg: Required<Config> = {
  pads: { l: 0.05, r: 0.05, t: 0.05, b: 0.1 },
  startCoords: { tl: [0, 0], size: [1, 1] }, whichCorners: 'secondary-diagonal',
  grid: { line: { stroke: 'green', strokeWidth: 1.5, strokeLinecap: 'round' } },
  canvas: { selection: false, uniformScaling: false, hoverCursor: 'pointer' },
  cornerOptions: { radius: defaultRadius, selectedRadius: defaultSelectedRadius, stroke: 'green', fill: undefined, strokeWidth: 2 },
  topBias: 0.2, leftBias: 0.2,
  templateOptions: { backgroundColor: '#0402', selectable: false }
}
const defaultSize: Vec2 = [300, 400]

export function useGridSelector(src: string, template: Template, config?: Config): Hook {
  
  const {
    pads, grid: gridCfg, canvas: canvasCfg, cornerOptions,
    leftBias, topBias, templateOptions, whichCorners
  } = {...defaultCfg, ...config}
  const startCoords = config?.startCoords ?? defaultCfg.startCoords
  const svgUrl = useMemo(() => gridUrl(
    template, gridCfg.size ?? defaultSize,
    {...defaultCfg.grid.line, ...gridCfg.line}
  ), [template, gridCfg])
  
  const templateRef = useRef<fabric.Object | null>(null);
  const sheetRef = useRef<fabric.Image | null>(null);
  const cornersRef = useRef<RectCorners<fabric.Object> | null>(null);
  const lastPtr = useRef<Vec2 | null>(null)
  const movingCorner = useRef<Vec2 | null>(null)
  const frameCounter = useRef(0) // throttling updates

  const [loaded, setLoaded] = useState(false)

  const { canvas, ref } = useFabric({ ...defaultCfg, ...canvasCfg});

  const moveTemplate = useCallback((corners: RectCorners<fabric.Object>, template: fabric.Object) => {
    const left = corners[0][0].left!
    const top = corners[0][0].top!
    const right = corners[1][1].left!
    const bot = corners[1][1].top!
    const size = vec.sub([left, top], [right, bot])
    const [scaleX, scaleY] = vec.div(size, gridCfg.size ?? defaultSize)
    template.set({ left: Math.round(left), top: Math.round(top), scaleX, scaleY })
    template.setCoords()
  }, [gridCfg.size])

  const initTemplate = useCallback((templ: fabric.Image, canvas: fabric.Canvas, sheet: fabric.Image) => {
    const tl = obj.rescale(startCoords.tl, sheet)
    const br = obj.rescale(vec.add(startCoords.tl, startCoords.size), sheet)
    const size = vec.sub(br, tl)
    const tr: Vec2 = [br[0], tl[1]]
    const bl: Vec2 = [tl[0], br[1]]

    const [scaleX, scaleY] = vec.div(size, gridCfg.size ?? defaultSize)
    templ.set({ left: tl[0], top: tl[1], scaleX, scaleY })
    templ.setCoords()
    canvas.add(templ)
    templateRef.current = templ

    const pts: RectCorners<Vec2> = [[tl, bl], [tr, br]]
    const corners: RectCorners<fabric.Object> = crn.map(pts, (p, [i, j]) => {
      const visible = whichCorners === 'all' || (i + j === 1) === (whichCorners === 'secondary-diagonal')
      const c = corner(p, {...defaultCfg.cornerOptions, ...cornerOptions, visible })
      canvas.add(c)
      c.bringToFront()
      return c
    })
    cornersRef.current = corners

    canvas.on('mouse:move', e => {
      const idx = movingCorner.current
      if (idx !== null && lastPtr.current) {
        const [i, j] = idx
        const c = corners[i][j]
        const { x, y } = e.pointer!
        const [dx, dy] = vec.sub([x, y], lastPtr.current)
        const to = obj.clamped([c.left! + dx, c.top! + dy], sheet)
        const updates = crn.move(idx, to)
        crn.map(corners, (c, [i, j]) => {
          c.set(updates[i][j])
          c.setCoords()
        })
        
        moveTemplate(corners, templ)
        
        const d = vec.dist(lastPtr.current, [x, y])
        // throttling
        if (frameCounter.current > 0 || (d < 0.1)) {
          canvas.renderAll()
          frameCounter.current = 0
        }
        else
          frameCounter.current++
        lastPtr.current = [x, y]
      }
    })

    canvas.on('mouse:down', e => {
      frameCounter.current = 0
      const { x, y } = e.pointer!
      const indexed = crn.map(corners, (x, i) => [x, i] as [fabric.Object, Vec2])
      const [i, j] = argminBy2(indexed, ([c, [i, j]]) => {
        if (whichCorners !== 'all' && (i + j === 1) === (whichCorners === 'main-diagonal'))
          return Infinity
        /** Bias towards selecting coords on top/left (as it's harder to access them in mobile) */
        const loweredCoords = vec.add(obj.tl(c), [leftBias*obj.width(sheet), topBias*obj.height(sheet)])
        return vec.dist(loweredCoords, [x, y])
      })
      movingCorner.current = [i, j]
      lastPtr.current = [x, y]
      corners[i][j].animate('radius', cornerOptions.selectedRadius ?? defaultSelectedRadius, {
        onChange: () => canvas.renderAll(),
        duration: 100
      })
    })
    canvas.on('mouse:up', () => {
      const idx = movingCorner.current
      if (idx !== null)
        corners[idx[0]][idx[1]].animate('radius', cornerOptions.radius ?? defaultRadius, {
          onChange: () => canvas.renderAll(),
          duration: 100
        })
      movingCorner.current = null
      lastPtr.current = null
    })

    setLoaded(true)
  }, [startCoords, cornerOptions, gridCfg.size, leftBias, topBias, moveTemplate, whichCorners]);

  const initSheet = useCallback((img: fabric.Image, canvas: fabric.Canvas) => {
    const { l, r, t, b } = pads
    const [w, h] = [canvas.width!, canvas.height!]
    const maxH = (1 - t - b) * h
    const maxW = (1 - l - r) * w
    const maxAspect = maxW / maxH
    const imgAspect = obj.width(img) / obj.height(img)
    if (imgAspect > maxAspect)
      // too wide
      img.scaleToWidth(maxW);
    else
      // too tall
      img.scaleToHeight(maxH)

    const topProp = t+b > 0 ? t/(t+b) : 0.5 // equivalent to *0.5 when pads are equal on both sides
    const leftProp = l+r > 0 ? l/(l+r) : 0.5
    img.top =  (h - obj.height(img))*topProp
    img.left = (w - obj.width(img))*leftProp
    
    canvas.add(img);
    img.sendToBack();
    sheetRef.current = img
    fabric.Image.fromURL(svgUrl, templ => initTemplate(templ, canvas, img), {selectable: false, ...templateOptions})
  }, [pads, initTemplate, svgUrl, templateOptions])

  const init = useCallback((canvas: fabric.Canvas) => {
    fabric.Image.fromURL(
      src, img => initSheet(img, canvas),
      { selectable: false }
    )
  }, [initSheet, src])

  /** Coords of `templ` relative to `sheet` */
  function computeCoords(): Coords {
    const templ = templateRef.current!; // [Tp, Ts] = [position (top left), size]
    const sheet = sheetRef.current!;    // [Sp, Ss]
    // Tp' = (Tp - Sp) / Ss
    const tl = vec.div(
      vec.sub(obj.tl(templ), obj.tl(sheet)),
      obj.size(sheet)
      )
    // Ts' = Ts / Ss
    const size = vec.div(obj.size(templ), obj.size(sheet))
    return { tl, size };
  }

  const animate = useCallback(({ tl, size }: Partial<Coords>, config?: AnimationConfig) => {
    const promise = managedPromise()
    const corners = cornersRef.current
    const templ = templateRef.current
    if (corners && templ && sheetRef.current && canvas) {
      if (tl) {
        const [left, top] = obj.rescale(tl, sheetRef.current)
        const corner = corners[0][0]
        corner.animate({ left, top }, {
          ...config, onComplete: () => promise.resolve(), onChange() {
            const updates = crn.move([0, 0], [corner.left!, corner.top!])
            crn.map(corners, (c, [i, j]) => {
              c.set(updates[i][j])
              c.setCoords()
            })
            moveTemplate(corners, templ)
            canvas.renderAll();
          }
        })
      }
      if (size) {
        const targetTl = tl ?? computeCoords().tl
        const targetBr = vec.add(targetTl, size)
        const [left, top] = obj.rescale(targetBr, sheetRef.current)
        const corner = corners[1][1]
        corner.animate({ left, top }, {
          ...config, onComplete: () => promise.resolve(), onChange() {
            const updates = crn.move([1, 1], [corner.left!, corner.top!])
            crn.map(corners, (c, [i, j]) => {
              c.set(updates[i][j])
              c.setCoords()
            })
            moveTemplate(corners, templ)
            canvas.renderAll();
          }
        })
      }
      return promise
    }
    else {
      return Promise.resolve()
    }
  }, [canvas, moveTemplate])

  const started = useRef(false)
  useEffect(() => {
    if (canvas && !started.current) {
      started.current = true
      init(canvas);
    }
  }, [init, canvas]);

  return { ref, coords: computeCoords, animate: loaded ? Object.assign(animate, { loaded }) : { loaded }  }
}
