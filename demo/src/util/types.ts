import { Coords } from 'use-grid-selector'
import { ModelID } from 'scoresheet-models'
import { managedAsync, managedPromise } from 'promises-tk'

export type Pads = { l: number, r: number, t: number, b: number }

export type Action = PostImage | ExtractBoxes

export type PostImage = {
  action: 'post-img'
  img: string | Blob
  imgId?: string
} 
export type ExtractBoxes = {
  action: 'extract-boxes'
  imgId?: string
  coords: Coords
  modelId: ModelID
  config?: ExtractConfig
}

export type BaseConfig = {
  from?: number
  to?: number
  pads?: Pads
  imgId?: string
}
export type BlobConfig = { return?: 'blob' } & BaseConfig
export type URLConfig = { return: 'url' } & BaseConfig
export type ExtractConfig = BlobConfig | URLConfig

export type Return<A extends Action> = A extends PostImage ? Promise<boolean> : AsyncIterable<Blob>

export type ExtractAPI = {
  /** Post an image to the worker
   * - `img`: the image url or blob
   * - `imgId`: reference to the image (necessary if you'll pass multiple images to the same worker)
   */
  postImg(img: string | Blob, imgId?: string): Promise<void>
  /** Extract boxes. Requires having posted an image with `postImg` first
   * - `config.imgId`: must match some id specified in `postImg`,
   * - `[config.from, config.to)`: range of box indices to extract
   * - `config.pads`: relative paddings (to the box size)
   */
  extract(modelId: ModelID, coords: Coords, config?: BlobConfig): AsyncIterable<Blob>
  extract(modelId: ModelID, coords: Coords, config?: URLConfig): AsyncIterable<string>
}

export function prepareWorker(worker: Worker): ExtractAPI {
  
  let postPromise = managedPromise()
  const extractStream = managedAsync<Blob|string>()

  worker.onmessage = async ({ data }: MessageEvent<Blob | string | null>) => {
    if (data === null)
      postPromise.resolve()
    else
      extractStream.push(data)
  }
  return {
    async postImg(img, imgId) {
      postPromise = managedPromise()
      const msg: PostImage = { img, imgId, action: 'post-img' }
      worker.postMessage(msg)
      await postPromise
    },
    async * extract(modelId, coords, config) {
      const msg: ExtractBoxes = { modelId, coords, config, action: 'extract-boxes' }
      worker.postMessage(msg)
      for await (const result of extractStream)
        yield result as any
    }
  }
}