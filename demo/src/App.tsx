import { Coords, useGridSelector, Vec2 } from 'use-grid-selector'
import { grid, models } from 'scoresheet-models'
import { Box, Button, ButtonGroup, HStack, Image, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import { useEffect, useRef, useState } from 'react'
import { managedPromise } from 'promises-tk'
import { Message, prepareWorker } from './util/types'
import { SerializedImg } from '../../../../cv/opencv-tools/src/workers'
import { cvtools, workers } from 'opencv-tools'

const printVec = ([x, y]: Vec2, precision = 2) => `(${x.toFixed(precision)}, ${y.toFixed(precision)})`

const worker = new Worker(new URL('./util/worker.ts', import.meta.url), { type: 'module' })
const api = prepareWorker(worker)

const startCoords: Coords = {
  tl: [0.04, 0.195],
  size: [0.95, 0.67]
}

function App() {
  const src = '/images/models/fcde/l.jpg'
  const { ref, coords } = useGridSelector(src, grid(models.fcde), { startCoords })
  const [{ tl, size }, setCoords] = useState<Coords>(startCoords)
  const [imgs, setImgs] = useState<string[]>([])
  const posted = useRef(managedPromise<void>())

  useEffect(() => {
    api.postImg(src).then(() => posted.current.resolve())
  }, [])

  async function extract() {
    setImgs([])
    await posted.current
    for await (const r of api.extract('fcde', coords(), {return: 'url', to: 16})) {
      setImgs(ims => [...ims, r])
    }
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
