import { Model } from 'scoresheet-models'
import { ManagedPromise, managedPromise } from 'promises-tk'
import { Rectangle } from '../types.js'
import { Paddings } from '../util/extract.js'

export type Action = PostImage | PostConfig | Extract

type BaseParams = { imgId: number, reqId: number }
export type PostImage = BaseParams & {
  action: 'post-img'
  img: string | Blob
} 
export type PostConfig = BaseParams & {
  action: 'post-config'
  config: ExtractConfig
}
export type Extract = BaseParams & {
  action: 'extract-box'
  idx: number
}

export type ExtractConfig = {
  model: Model
  coords: Rectangle
  pads?: Paddings
}

export type Return<A extends Action['action']> =
  A extends 'post-img' ? Promise<boolean> :
  A extends 'post-config' ? Promise<void> :
  Promise<Blob|null>

export type Response = {
  [A in Action['action']]: {
    action: A
    reqId: number
    value: Awaited<Return<A>>
  }
}[Action['action']]
export type Responses = {
  [A in Action['action']]: Map<number, ManagedPromise<Return<A>>>
}

export type ExtractAPI = {
  /** Optimization: send the image upfront so the first `extract` call doesn't take the extra, significant hit
   * - `img`: the image url or blob
   * - `imgId`: reference to the image
   * - Returns whether it succeeds (it may fail, e.g. due to `OffscreenCanvas` not being available)
   */
  postImg(img: string | Blob): Promise<boolean>
  /** Optimization: send the config upfront so the first `extract` call doesn't take the extra, not-so-significant hit
   * - Also sends `img` if not done already
   */
  postConfig(img: string | Blob, config: ExtractConfig): Promise<void>
  /** Extract box at `idx`
   * - `config.pads`: relative paddings (to the box size)
   * 
   * #### Note on performance
   * Both `img` (if a `Blob`) and `config` are cached by reference and only sent to the worker once. So, you should prefer:
   * 
   * ```jsx
   * // this
   * const img: Blob = ...
   * const config: ExtractConfig = ...
   * for (const i of range(16))
   *  imgs.push(await api.extract(img, config))
   * 
   * // over defining a new object at every call
   * for (const i of range(16))
   *   imgs.push(await api.extract(makeBlob(), { ... }))
   * ```
   * 
   * - Expect a ~40% overhead for sending config anew
   * - Expect a slowdown of at least an order of magnitude for sending the image anew (depends on the size, ofc)
   */
  extract(img: string | Blob, idx: number, config: ExtractConfig): Promise<Blob|null>
}

export function makeApi(postMessage: (action: Action) => void, log?: Console['debug']): {
  api: ExtractAPI
  onMessage(e: MessageEvent<Response>): void
} {
  const debug = log && ((...xs) => log('[ExtractAPI]:', ...xs))

  let imgIdCounter = 0
  const imgIDs = new Map<Blob|string, number>()
  const configsCache = new Map<number, ExtractConfig>()

  const responses: Responses = {
    "post-img": new Map(),
    "post-config": new Map(),
    "extract-box": new Map(),
  }

  let reqIdCounter = 0

  const onMessage = ({ data }: MessageEvent<Response>) => {
    debug?.('Response received:', data)
    responses[data.action].get(data.reqId)?.resolve(data.value as any) // typescript ain't that smart sometimes
  }

  /** Stores image into `imgIDs`, posts to worker, returns the assigned key */
  async function postNewImg(img: string | Blob): Promise<number|null> {
    const reqId = reqIdCounter++
    responses['post-img'].set(reqId, managedPromise())
    const imgId = imgIdCounter++
    debug?.(`New image. ID = ${imgId}. Src:`, img)
    imgIDs.set(img, imgId)
    const msg: PostImage = { img, imgId, reqId, action: 'post-img' }
    postMessage(msg)
    const succeeded = await responses['post-img'].get(reqId)
    responses['post-img'].delete(reqId)
    console.assert(succeeded !== undefined, "Logic error. Promise should've been defined")
    debug?.('Post image', succeeded ? 'succeeded' : 'failed')
    if (!succeeded) {
      imgIDs.delete(img)
      return null
    }
    return imgId
  }

  async function postConfig(imgId: any, config: ExtractConfig) {
    const reqId = reqIdCounter++
    responses['post-config'].set(reqId, managedPromise())
    debug?.('New config for', imgId, 'Config:', config)
    const msg: PostConfig = { imgId, config, reqId, action: 'post-config' }
    postMessage(msg)
    const promise = responses['post-config'].get(reqId)
    console.assert(promise !== undefined, "Logic error. Promise should've been defined")
    await promise
    responses['post-config'].delete(reqId)
    configsCache.set(imgId, config)
  }

  const api: ExtractAPI = {
    async postImg(img) {
      return (await postNewImg(img)) !== null
    },
    async postConfig(img, config) {
      const imgId = imgIDs.get(img) ?? await postNewImg(img)
      if (imgId !== null)
        await postConfig(imgId, config)
    },
    async extract(img, idx, config) {
      const reqId = reqIdCounter++
      responses['extract-box'].set(reqId, managedPromise())
      const imgId = imgIDs.get(img) ?? await postNewImg(img)
      if (imgId === null)
        return null
      if (configsCache.get(imgId) !== config)
        await postConfig(imgId, config)
      debug?.('Extracting box', idx, 'from image', imgId)
      const msg: Extract = { imgId, idx, reqId, action: 'extract-box' }
      postMessage(msg)
      const result = await responses['extract-box'].get(reqId)
      console.assert(result !== undefined, "Logic error. Promise should've been defined")
      responses['extract-box'].delete(reqId)
      debug?.('Extracted box', idx, 'from image', imgId)
      return result ?? null
    }
  }

  return { onMessage, api }
}

/** Prepares worker by setting `worker.onmessage`. Do not modify it after preparing! */
export function prepareWorker(worker: Worker, log?: Console['debug']): ExtractAPI {
  const { api, onMessage } = makeApi(worker.postMessage.bind(worker), log)
  worker.onmessage = onMessage
  return api
}