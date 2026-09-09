
/* Will add appConfig import */

// Configuration for the request
export interface RequestConfig<TBody = unknown> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: TBody
  headers?: Record<string, string>
  query?: Record<string, string | number | boolean | undefined>
  signal?: AbortSignal
}

export interface HttpClientConfig {
  baseUrl?: string
}

interface ErrorResponseShape {
  error?: {
    message?: string
  }
}

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: 'application/json',
  Content-Type: 'application/json',
}
