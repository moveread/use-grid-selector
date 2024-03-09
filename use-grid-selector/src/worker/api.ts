import { Model } from 'scoresheet-models'
import { ManagedPromise, managedPromise } from 'promises-tk'
import { Rectangle } from '../types.js'
import { Paddings } from '../util/extract.js'

export type Action = PostImage | PostConfig | Extract

export type PostImage = {
  action: 'post-img'
  img: string | Blob
  imgId: any
} 
export type PostConfig = {
  action: 'post-config'
  config: ExtractConfig
  imgId: any
}
export type Extract = {
  action: 'extract-box'
  imgId: any
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
    value: Awaited<Return<A>>
  }
}[Action['action']]
export type Responses = {
  [A in Action['action']]: ManagedPromise<Return<A>>
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

/** Prepares worker by setting `worker.onmessage`. Do not modify it after preparing! */
export function prepareWorker(worker: Worker, log?: Console['debug']): ExtractAPI {
  
  const debug = log && ((...xs) => log('[ExtractAPI]:', ...xs))

  let counter = 0
  const imgIDs = new Map<Blob|string, number>()
  const configsCache = new Map<number, ExtractConfig>()

  const responses: Responses = {
    "post-img": managedPromise(),
    "post-config": managedPromise(),
    "extract-box": managedPromise()
  }

  worker.onmessage = async ({ data }: MessageEvent<Response>) => {
    debug?.('Response received:', data)
    responses[data.action].resolve(data.value as any) // typescript ain't that smart sometimes
  }

  /** Stores image into `imgIDs`, posts to worker, returns the assigned key */
  async function postNewImg(img: string | Blob): Promise<number|null> {
    responses['post-img'] = managedPromise()
    const imgId = counter++
    debug?.(`New image. ID = ${imgId}. Src:`, img)
    imgIDs.set(img, imgId)
    const msg: PostImage = { img, imgId, action: 'post-img' }
    worker.postMessage(msg)
    const succeeded = await responses['post-img']
    debug?.('Post image', succeeded ? 'succeeded' : 'failed')
    if (!succeeded) {
      imgIDs.delete(img)
      return null
    }
    return imgId
  }

  async function postConfig(imgId: any, config: ExtractConfig) {
    responses['post-config'] = managedPromise()
    debug?.('New config for', imgId, 'Config:', config)
    const msg: PostConfig = { imgId, config, action: 'post-config' }
    worker.postMessage(msg)
    await responses['post-config']
    configsCache.set(imgId, config)
  }

  return {
    async postImg(img) {
      return (await postNewImg(img)) !== null
    },
    async postConfig(img, config) {
      const imgId = imgIDs.get(img) ?? await postNewImg(img)
      if (imgId !== null)
        await postConfig(imgId, config)
    },
    async extract(img, idx, config) {
      responses['extract-box'] = managedPromise()
      const imgId = imgIDs.get(img) ?? await postNewImg(img)
      if (imgId === null)
        return null
      if (configsCache.get(imgId) !== config)
        await postConfig(imgId, config)
      debug?.('Extracting box', idx, 'from image', imgId)
      const msg: Extract = { imgId, idx, action: 'extract-box' }
      worker.postMessage(msg)
      const result = await responses['extract-box']
      debug?.('Extracted box', idx, 'from image', imgId)
      return result
    }
  }
}