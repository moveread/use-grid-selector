/// <reference lib="WebWorker" />

import { Cv, Mat } from "use-cv";
import { io } from 'opencv-tools'
import { Action, ExtractBoxes, PostImage } from "./api";
import * as vec from "../util/vectors";
import * as sm from 'scoresheet-models'
import { range } from 'ramda'
import { roi } from "../util/extract";

export function onmessage(cv: Cv, log?: Console['debug']) {

  const debug = log && ((...data: any[]) => log('[WORKER]:', ...data))

  const loaded: Promise<void> = new Promise(resolve => {
    cv.onRuntimeInitialized = () => {
      resolve()
      debug?.('OpenCV loaded')
    }
  })

  const images: Map<string, Mat> = new Map();

  async function setImage({ img, imgId }: PostImage): Promise<boolean> {
    const blob = typeof img === 'string' ? await fetch(img).then(r => r.blob()) : img
    const data = await io.read(blob)
    if (!data)
      return false
    const mat = cv.matFromImageData(data)
    images.set(imgId, mat)
    return true
  }

  async function* extractBoxes({ modelId, coords, config }: ExtractBoxes) {
    const mat = images.get(config.imgId)
    if (!mat) {
      yield null
      return
    }

    const imgSize: vec.Vec2 = [mat.cols, mat.rows]
    const model = sm.models[modelId]
    const tl = vec.prod(coords.tl, imgSize)
    const size = vec.prod(coords.size, imgSize)
    const boxSize = vec.prod(sm.boxSize(model), size)

    const from = config?.from ?? 0
    const to = config?.to ?? model.boxPositions.length

    for (const idx of range(from, to)) {
      const p = model.boxPositions[idx]
      const [x, y] = vec.add(vec.prod(p, size), tl)
      const box = roi(mat, { tl: [x, y], size: boxSize }, config?.pads)
      yield await io.writeBlob(box)
    }
  }

  async function onmessage(e: MessageEvent<Action>) {
    await loaded
    if (e.data.action === 'post-img') {
      const succeeded = await setImage(e.data)
      postMessage(succeeded)
    }
    else if (e.data.action === 'extract-boxes') {
      for await (const x of extractBoxes(e.data))
        postMessage(x)
      postMessage(null)
    }
  }

  return onmessage
}