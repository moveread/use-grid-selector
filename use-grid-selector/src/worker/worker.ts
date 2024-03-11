/// <reference lib="WebWorker" />

import { Cv, Mat } from "use-cv";
import { io } from 'opencv-tools'
import { Action, Extract, ExtractConfig, PostConfig, PostImage, Response } from "./api.js";
import * as vec from "../util/vectors.js";
import * as sm from 'scoresheet-models'
import { roi } from "../util/extract.js";

export type WorkerAPI = {
  postImg(a: Omit<PostImage, 'action'>): Promise<boolean>
  postConfig(a: Omit<PostConfig, 'action'>): void
  extract(a: Omit<Extract, 'action'>): Promise<Blob|null>
  configs: ReadonlyMap<any, ExtractConfig>
}

export function makeApi(cv: Cv, log?: Console['debug']): WorkerAPI {

  const debug = log && ((...data: any[]) => log('[WORKER]:', ...data))

  const loaded: Promise<void> = new Promise(resolve => {
    cv.onRuntimeInitialized = () => {
      resolve()
      debug?.('OpenCV loaded')
    }
  })

  const images: Map<any, Mat> = new Map();
  const configs: Map<any, ExtractConfig> = new Map()

  type ReifiedConfig = {
    model: sm.ReifiedModel
    tl: vec.Vec2, size: vec.Vec2, boxSize: vec.Vec2
  }
  const cache: Map<any, ReifiedConfig> = new Map()

  function reifiedConfig(mat: Mat, { coords, model }: ExtractConfig): ReifiedConfig {
    const imgSize: vec.Vec2 = [mat.cols, mat.rows]
    const tl = vec.prod(coords.tl, imgSize)
    const size = vec.prod(coords.size, imgSize)
    const boxSize = vec.prod(sm.boxSize(model), size)
    return { model: sm.reify(model), boxSize, tl, size }
  }
  function reifyConfig(imgId: any, mat: Mat, config: ExtractConfig): ReifiedConfig {
    const result = reifiedConfig(mat, config)
    cache.set(imgId, result)
    return result
  }

  async function postImg({ img, imgId }: PostImage): Promise<boolean> {
    const blob = typeof img === 'string' ? await fetch(img).then(r => r.blob()) : img
    const data = await io.read(blob)
    if (!data)
      return false
    
    await loaded
    const mat = cv.matFromImageData(data)
    debug?.('Stored new image', imgId)
    images.set(imgId, mat)
    cache.delete(imgId)
    return true
  }

  function postConfig({ config, imgId }: PostConfig) {
    configs.set(imgId, config)
    cache.delete(imgId)
  }

  async function extract({ imgId, idx }: Extract): Promise<Blob|null> {
    const mat = images.get(imgId)
    const config = configs.get(imgId)
    if (!mat || !config)
      return null

    const { model, boxSize, size, tl} = cache.get(imgId) ?? reifyConfig(imgId, mat, config)
    const p = model.boxPositions[idx]
    const [x, y] = vec.add(vec.prod(p, size), tl)
    debug?.('Box position', x, y)
    const box = roi(mat, { tl: [x, y], size: boxSize }, config?.pads)
    return await io.writeBlob(box)
  }

  return { postImg, postConfig, extract, configs }

}

export function messageHandler({ postImg, postConfig, extract }: WorkerAPI) {
  async function handle(data: Action): Promise<Response> {
    const { action } = data
    switch (action) {
      case 'post-img':
        return { action, value: await postImg(data) }
      case 'post-config':
        return { action, value: postConfig(data) }
      case 'extract-box':
        return { action, value: await extract(data) }
    }
  }
  
  return handle
}

export function onMessage(cv: Cv, log?: Console['debug']) {
  const handle = messageHandler(makeApi(cv, log))
  async function onmessage({ data }: MessageEvent<Action>) {
    postMessage(await handle(data))
  }
  return onmessage
}