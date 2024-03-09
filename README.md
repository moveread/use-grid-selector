# Use Grid Selector

> Mobile friendly grid selector

- Demo: https://moveread.github.io/use-grid-selector/

## Usage

### UI

```jsx
import { useGridSelector } from 'use-grid-selector'

const { ref, coords } = useGridSelector('/image.jpg', template)

function displayCoords() {
  console.log(coords())
}

return (
  ...
  <canvas ref={ref} />
)
```

### Extracting ROIs

- `worker.ts`:

  ```jsx
  import cv from "opencv-ts"; // or importScripts to a custom opencv.js, or whatever
  import { onMessage } from 'use-grid-selector/worker'
  onmessage = onMessage(cv)
  ```

- `MySelector.tsx`:
  
  ```jsx
  import { grid, models } from 'scoresheet-models'
  import { prepareWorker } from 'use-grid-selector/worker'

  const worker = new Worker('/path/to/worker.ts')
  const api = prepareWorker(worker) // perhaps it'd be recommendable to keep this stuff in a `useRef`

  function MySelector() {
    const img = '/image.jpg'
    const model = models.fcde // or an arbitrary Model
    const { ref, coords } = useGridSelector(img, grid(model))
    function initialize() {
      api.postImg(img) // not necessary, but makes subsequent calls faster
    }
    async function extract() {
      const config = { model, coords: coords() }
      for (const idx of range(16)) {
        const blob = await api.extract(img, idx, config)
      }
    }
  }
  ```

  You can also pre-post the configuration if you wont change it further:

  ```jsx
  const CONFIG = { ... }
  api.postConfig(CONFIG)

  // then always call with
  api.extract(img, CONFIG)
  ```