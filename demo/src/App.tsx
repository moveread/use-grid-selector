import { Rectangle, useGridSelector, Vec2 } from 'use-grid-selector'
import { grid, models } from 'scoresheet-models'
import { ButtonGroup, Button, HStack, Image, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import { useEffect, useRef, useState } from 'react'
import { managedPromise } from 'promises-tk'
import { prepareWorker } from 'use-grid-selector/worker'

function* range(from: number, to: number, delta = 1) {
  for (let i = from; i < to; i += delta)
    yield i
}
const printVec = ([x, y]: Vec2, precision = 2) => `(${x.toFixed(precision)}, ${y.toFixed(precision)})`

const worker = new Worker(new URL('worker.ts', import.meta.url), { type: 'module' })
const api = prepareWorker(worker, console.debug.bind(console))

const startCoords: Rectangle = {
  tl: [0.04, 0.195],
  size: [0.95, 0.67]
}

const src = import.meta.env.BASE_URL + '/sheet.jpg'

function App() {
  const { ref, coords } = useGridSelector(src, grid(models.fcde), { startCoords })
  const [{ tl, size }, setCoords] = useState<Rectangle>(startCoords)
  const [imgs, setImgs] = useState<string[]>([])
  const ready = useRef(managedPromise<void>())

  async function prepare() {
    await api.postImg(src)
    ready.current.resolve()
  }

  useEffect(() => { prepare() }, [])

  async function extract() {
    setImgs([])
    const config = { coords: coords(), model: models.fcde }
    let results: string[] = []
    await ready.current
    console.time('Extract')
    for (const i of range(0, 150, 15)) {
      await Promise.all([...range(i, i+15)].map(async (i) => {
        const blob = await api.extract(src, i, config)
        if (blob)
          results.push(URL.createObjectURL(blob))
      }))
      const mod = 12
      if (i % mod === mod-1) {
        const newResults = [...results]
        setImgs(ims => {
          return [...ims, ...newResults]
        })
        results = []
      }
    }
    console.timeEnd('Extract')
    setImgs(ims => [...ims, ...results])
  }

  return (
    <VStack h='100vh' w='100vw' align='center' justify='center'>
      <Text>Top Left: {printVec(tl)}. Size: {printVec(size)}</Text>
      <HStack h='80%' w='100%'>
        <VStack h='100%' w='50%' align='center' justify='center'>
          <canvas ref={ref} />
          <ButtonGroup>
            <Button onClick={() => setCoords(coords())}>Update coords</Button>
            <Button onClick={extract}>Extract</Button>
          </ButtonGroup>
        </VStack>
        <SimpleGrid h='100%' w='50%' columns={2} spacing='2rem'>
          {imgs.map((src, i) => (
            <HStack key={i}>
              <Text>{i}</Text>
              <Image src={src} />
            </HStack>
          ))}
        </SimpleGrid>
      </HStack>
    </VStack>
  )
}

export default App
