import { ModelID } from 'scoresheet-models'
import { managedAsync, managedPromise } from 'promises-tk'
import { Rectangle } from '../types.js'
import { Paddings } from '../util/extract.js'

export type Action = PostImage | ExtractBoxes

export type PostImage = {
  action: 'post-img'
  img: string | Blob
  imgId: any
} 
export type ExtractBoxes = {
  action: 'extract-boxes'
  coords: Rectangle
  modelId: ModelID
  imgId: any
  config?: ExtractConfig
}

export type ExtractConfig = {
  from?: number
  to?: number
  pads?: Paddings
}

export type Return<A extends Action> = A extends PostImage ? Promise<boolean> : AsyncIterable<Blob>

export type ExtractAPI = {
  /** Optimization: send the image upfront so the first `extract` call doesn't take the extra, significant hit
   * - `img`: the image url or blob
   * - `imgId`: reference to the image
   * - Returns whether it succeeds (it may fail, e.g. due to `OffscreenCanvas` not being available)
   */
  postImg(img: string | Blob): Promise<boolean>
  /** Extract boxes. Requires having posted an image with `postImg` first
   * - `config.imgId`: must match some id specified in `postImg`,
   * - `[config.from, config.to)`: range of box indices to extract
   * - `config.pads`: relative paddings (to the box size)
   */
  extract(img: string | Blob, modelId: ModelID, coords: Rectangle, config?: ExtractConfig): AsyncIterable<Blob>
}

/** Prepares worker by setting `worker.onmessage`. Do not modify it after preparing! */
export function prepareWorker(worker: Worker): ExtractAPI {
  
  let counter = 0
  const imgIDs = new Map<Blob|string, number>()

  let postPromise = managedPromise<boolean>()
  const extractStream = managedAsync<Blob|null>()

  worker.onmessage = async ({ data }: MessageEvent<Blob|null|boolean>) => {
    if (typeof data === 'boolean')
      postPromise.resolve(data)
    else
      extractStream.push(data)
  }

  /** Stores image into `imgIDs`, posts to worker, returns the assigned key */
  async function postNewImg(img: string | Blob): Promise<number|null> {
    postPromise = managedPromise()
    const imgId = counter++
    console.debug(`New image. ID = ${imgId}. Src:`, img)
    imgIDs.set(img, imgId)
    const msg: PostImage = { img, imgId, action: 'post-img' }
    worker.postMessage(msg)
    const succeeded = await postPromise
    if (!succeeded) {
      imgIDs.delete(img)
      return null
    }
    return imgId
  }

  return {
    async postImg(img) {
      return (await postNewImg(img)) !== null
    },
    async * extract(img, modelId, coords, config) {
      const imgId = imgIDs.get(img) ?? await postNewImg(img)
      if (imgId === null)
        return
      console.debug('Extracting image', imgId)
      const msg: ExtractBoxes = { imgId, modelId, coords, config, action: 'extract-boxes' }
      worker.postMessage(msg)
      for await (const x of extractStream) {
        console.debug('Extract result', x)
        if (x === null)
          return
        yield x
      }
    }
  }
}