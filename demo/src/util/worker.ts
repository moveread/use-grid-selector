/// <reference lib="WebWorker" />

import cv, { Mat, Rect } from 'opencv-ts'
import * as sm from 'scoresheet-models'
import { Action, ExtractBoxes, Pads, PostImage } from './types'
import { vec } from '.'
import { Vec2 } from './vectors'
import { range } from 'ramda'
import { read, write } from './io'

const debug = (...data) => console.debug('[WORKER]:', ...data)

const loaded: Promise<void> = new Promise(resolve => {
  cv.onRuntimeInitialized = () => {
    resolve()
    debug('OpenCV loaded')
  }
})

const images: Map<string, Mat> = new Map();
let defaultImage: Mat | null = null

async function setImage({ img, imgId }: PostImage) {
  const blob = typeof img === 'string' ? await fetch(img).then(r => r.blob()) : img
  const data = await read(blob)
  const mat = cv.matFromImageData(data)
  if (imgId)
    images.set(imgId, mat)
  else
    defaultImage = mat
  postMessage(null)
}

const defaultPads: Pads = {
  l: 0.1, r: 0.1, t: 0.1, b: 0.2
}

async function extractBoxes({ modelId, imgId, coords, config }: ExtractBoxes) {
  const mat = imgId ? images.get(imgId) : defaultImage
  if (!mat) {
    debug(`Error: ${imgId ? `image with ID '${imgId}'` : 'default image'} not found`)
    return
  }
  
  const imgSize: Vec2 = [mat.cols, mat.rows]
  const model = sm.models[modelId]
  const tl = vec.prod(coords.tl, imgSize)
  const size = vec.prod(coords.size, imgSize)
  const [boxW, boxH] = vec.prod(sm.boxSize(model), size) // rescaled
  
  const { l, r, t, b } = { ...defaultPads, ...config?.pads }
  const from = config?.from ?? 0
  const to = config?.to ?? model.boxPositions.length

  for (const idx of range(from, to)) {
    const p = model.boxPositions[idx]
    const [x, y] = vec.add(vec.prod(p, size), tl) // rescaled and translated
    const rect = {
      x: x-l*boxW, y: y-t*boxH,
      width: (1+l+r)*boxW, height: (1+t+b)*boxH
    } as Rect
    const roi = mat.roi(rect).clone() // IMPORTANT: must clone to make the data continuous!
    console.assert(roi.isContinuous(), 'Error: ROI image not continuous')
    const thenBlob = write(roi)
    if (thenBlob) {
      const blob = await thenBlob
      postMessage(config?.return === 'url' ? URL.createObjectURL(blob) : blob)
    }
    roi.delete()
  }
  postMessage(null)
}

onmessage = async (e: MessageEvent<Action>) => {
  await loaded
  if (e.data.action === 'post-img')
    await setImage(e.data)
  else if (e.data.action === 'extract-boxes')
    await extractBoxes(e.data)
}
