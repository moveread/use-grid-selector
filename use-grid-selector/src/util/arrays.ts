export type NonEmptyArray<T> = [T, ...T[]]
export function nonEmpty<T>(xs: T[]): xs is NonEmptyArray<T> {
    return xs.length > 0
}

export function argminBy<T>(xs: NonEmptyArray<T>, f: (x: T) => number): number {
  let min = 0
  let minVal = f(xs[min])
  for (const [i, x] of xs.slice(1).entries()) {
    const val = f(x)
    if (val < minVal) {
      min = i+1
      minVal = val
    }
  }
  return min
}

export function argminBy2<T>(xxs: NonEmptyArray<NonEmptyArray<T>>, f: (x: T) => number): [number, number] {
  let min: [number, number] = [0, 0]
  let minVal = f(xxs[0][0])
  for (const [i, xs] of xxs.entries()) {
    for (const [j, x] of xs.entries()) {
      const val = f(x)
      if (val < minVal) {
        min = [i, j]
        minVal = val
      }
    }
  }
  return min
}