import { defineConfig } from 'orval'

export default defineConfig({
  curlhard: {
    input: './openapi.json',
    output: {
      mode: 'single',
      target: './src/api/generated/curlhard.ts',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        mutator: { path: './src/api/fetcher.ts', name: 'customFetch' },
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
})
