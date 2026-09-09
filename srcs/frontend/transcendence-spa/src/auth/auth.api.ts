
/* Will add appConfig import */


type HttpMethods = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type QueryParams = Record<string, string | number | boolean | undefined>;

// Configuration for the request
export interface RequestConfig<TBody = unknown> {
  method?: HttpMethods
  body?: TBody
  headers?: Record<string, string>
  query?: QueryParams
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
  'Accept': 'application/json',
  'Content-Type': 'application/json',
}

const RELATIVE_URL_BASE = 'https://localhost:8080/api/auth/'

// buildUul takes a path as required path if the path has a leading / this will
// be treated as an absolute path and will be appended to the baseUrl if provided, otherwise it will
// be appended to the RELATIVE_URL_BASE. If the path does not have a leading / it will be treated
// as a relative path and will be appended to the baseUrl or RELATIVE_URL_BASE with a leading /
// added. The query params are optional and will be appended to the URL if provided.
// The URL object is returned.
export function buildUrl(path: string, baseUrl?: string, query?: QueryParams): URL {
  const url = new URL(path, baseUrl || RELATIVE_URL_BASE)

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    })
  }

  return url
}
