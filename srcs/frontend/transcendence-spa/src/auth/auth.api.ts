
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
function buildUrl(path: string, baseUrl?: string, query?: QueryParams): URL {
  const url = new URL(path, baseUrl || RELATIVE_URL_BASE)

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    })
  }
  console.log('buildUrl', url.toString())
  return url
}

export class HttpClient {
  private baseUrl?: string

  constructor(config: HttpClientConfig = {}) {
    this.baseUrl = config?.baseUrl
  }

  async request<TResponse, TBody = unknown>(
    path: string,
    config: RequestConfig<TBody> = {},
  ): Promise<TResponse> {
      const headers: Record<string, string> = {
        ...DEFAULT_HEADERS,
        ...(config.headers ?? {}),
    }

    const response = await fetch(buildUrl(path, this.baseUrl, config.query),{
      method: config.method ?? 'GET',
      headers,
      body: config.body ? JSON.stringify(config.body) : undefined,
      signal: config.signal,
    })
    if (!response.ok) {
      let message = `HTTP ${response.status} ${response.statusText}`

      try {
        const errorResponse: ErrorResponseShape = await response.json()
        if (errorResponse?.error?.message) {
          message = errorResponse.error.message
        }
      } catch (e) {
        // Ignore JSON parsing errors and use the default message
      }

      throw new Error(message)
    }

    return (await response.json()) as TResponse
  }

  get<TResponse>(
    path: string,
    config: RequestConfig = {}
  ): Promise<TResponse> {
    return this.request<TResponse>(path, { ...config, method: 'GET' })
  }
}


























