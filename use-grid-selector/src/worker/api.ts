import { ModelID } from 'scoresheet-models'
import { managedAsync, managedPromise } from 'promises-tk'
import { Rectangle } from '../types'
import { Paddings } from '../util/extract'

export type Action = PostImage | ExtractBoxes

export type PostImage = {
  action: 'post-img'
  img: string | Blob
  imgId: string
} 
export type ExtractBoxes = {
  action: 'extract-boxes'
  coords: Rectangle
  modelId: ModelID
  config: ExtractConfig
}

export type ExtractConfig = {
  from?: number
  to?: number
  pads?: Paddings
  imgId: string
}

export type Return<A extends Action> = A extends PostImage ? Promise<boolean> : AsyncIterable<Blob>

export type ExtractAPI = {
  /** Post an image to the worker
   * - `img`: the image url or blob
   * - `imgId`: reference to the image
   * - Returns whether it succeeds (it may fail, e.g. due to `OffscreenCanvas` not being available)
   */
  postImg(img: string | Blob, imgId: string): Promise<boolean>
  /** Extract boxes. Requires having posted an image with `postImg` first
   * - `config.imgId`: must match some id specified in `postImg`,
   * - `[config.from, config.to)`: range of box indices to extract
   * - `config.pads`: relative paddings (to the box size)
   */
  extract(modelId: ModelID, coords: Rectangle, config: ExtractConfig): AsyncIterable<Blob>
}

/** Prepares worker by setting `worker.onmessage`. Do not modify it after preparing! */
export function prepareWorker(worker: Worker): ExtractAPI {
  
  let postPromise = managedPromise<boolean>()
  const extractStream = managedAsync<Blob|null>()

  worker.onmessage = async ({ data }: MessageEvent<Blob|null|boolean>) => {
    if (typeof data === 'boolean')
      postPromise.resolve(data)
    else
      extractStream.push(data)
  }
  return {
    async postImg(img, imgId) {
      postPromise = managedPromise()
      const msg: PostImage = { img, imgId, action: 'post-img' }
      worker.postMessage(msg)
      return await postPromise
    },
    async * extract(modelId, coords, config) {
      const msg: ExtractBoxes = { modelId, coords, config, action: 'extract-boxes' }
      worker.postMessage(msg)
      for await (const x of extractStream) {
        if (x === null)
          return
        yield x
      }
    }
  }
}