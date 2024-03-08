import { Mat } from "opencv-ts"
import { cvtools } from "../../../../../cv/opencv-tools/src"

export async function read(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height)
}

export function write(mat: Mat): Promise<Blob> | null {
  const continuousMat = mat.isContinuous() ? mat : mat.clone()
  const data = cvtools.toData(continuousMat)
  const canvas = new OffscreenCanvas(mat.cols, mat.rows)
  const shown = cvtools.show(data, canvas)
  return shown ? canvas.convertToBlob() : null
}