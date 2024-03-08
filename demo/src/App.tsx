import { Rectangle, useGridSelector, Vec2 } from 'use-grid-selector'
import { grid, models } from 'scoresheet-models'
import { ButtonGroup, Button, HStack, Image, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import { useEffect, useRef, useState } from 'react'
import { managedPromise } from 'promises-tk'
import { prepareWorker } from 'use-grid-selector/worker'

const printVec = ([x, y]: Vec2, precision = 2) => `(${x.toFixed(precision)}, ${y.toFixed(precision)})`

const worker = new Worker(new URL('worker.ts', import.meta.url), { type: 'module' })
const api = prepareWorker(worker)

const startCoords: Rectangle = {
  tl: [0.04, 0.195],
  size: [0.95, 0.67]
}

const src = import.meta.env.BASE_URL + '/sheet.jpg'

function App() {
  const { ref, coords } = useGridSelector(src, grid(models.fcde), { startCoords })
  const [{ tl, size }, setCoords] = useState<Rectangle>(startCoords)
  const [imgs, setImgs] = useState<string[]>([])
  const posted = useRef(managedPromise<void>())

  useEffect(() => {
    api.postImg(src).then(() => posted.current.resolve())
  }, [])

  async function extract() {
    setImgs([])
    await posted.current
    console.time('Extract')
    for await (const r of api.extract(src, 'fcde', coords())) {
      setImgs(ims => [...ims, URL.createObjectURL(r)])
    }
    console.timeEnd('Extract')
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
