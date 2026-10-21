/* Will add appConfig import */

type HttpMethods = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type QueryParams = Record<string, string | number | boolean | undefined>

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

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

interface ErrorResponseShape {
  error?: string
}

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

// The SPA and the API share a single origin (nginx serves the bundle and
// proxies /api/), so the base is derived at runtime. This keeps dev, prod,
// and any host/port in sync without a build-time configuration.
const RELATIVE_URL_BASE = `${window.location.origin}/api/auth/`

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
    const isFormData = config.body instanceof FormData
    if (isFormData) delete headers['Content-Type']

    const response = await fetch(buildUrl(path, this.baseUrl, config.query), {
      method: config.method ?? 'GET',
      headers,
      body: isFormData
        ? (config.body as FormData)
        : config.body
          ? JSON.stringify(config.body)
          : undefined,
      signal: config.signal,
    })
    if (!response.ok) {
      let message = `HTTP ${response.status} ${response.statusText}`

      try {
        const errorResponse = (await response.json()) as ErrorResponseShape

        if (errorResponse.error) {
          message = errorResponse.error
        }
      } catch {
        // Keep fallback message
      }

      throw new HttpError(message, response.status)
    }

    if (response.status === 204) {
      return undefined as TResponse
    }

    return (await response.json()) as TResponse
  }

  get<TResponse>(path: string, config: RequestConfig = {}): Promise<TResponse> {
    return this.request<TResponse>(path, { ...config, method: 'GET' })
  }

  post<TResponse>(path: string, body: unknown, config: RequestConfig = {}): Promise<TResponse> {
    return this.request<TResponse>(path, { ...config, method: 'POST', body })
  }

  patch<TResponse>(path: string, body: unknown, config: RequestConfig = {}): Promise<TResponse> {
    return this.request<TResponse>(path, { ...config, method: 'PATCH', body })
  }

  delete<TReponse>(path: string, config: RequestConfig = {}): Promise<TReponse> {
    return this.request<TReponse>(path, { ...config, method: 'DELETE' })
  }

  async download(
    path: string,
    config: RequestConfig = {},
  ): Promise<{ blob: Blob; filename: string }> {
    const headers: Record<string, string> = {
      ...DEFAULT_HEADERS,
      ...(config.headers ?? {}),
    }

    const response = await fetch(buildUrl(path, this.baseUrl, config.query), {
      method: config.method ?? 'GET',
      headers,
      signal: config.signal,
    })

    if (!response.ok) {
      let message = `HTTP ${response.status} ${response.statusText}`

      try {
        const errorResponse = (await response.json()) as ErrorResponseShape

        if (errorResponse.error) {
          message = errorResponse.error
        }
      } catch {
        // Keep fallback message
      }

      throw new HttpError(message, response.status)
    }

    const disposition = response.headers.get('Content-Disposition')
    let filename = 'user-data.json'
    if (disposition) {
      const match = disposition.match(/filename="?([^";]+)"?/)
      if (match && match[1]) {
        filename = match[1]
      }
    }

    const blob = await response.blob()
    return { blob, filename }
  }
}

export const httpClient = new HttpClient({ baseUrl: RELATIVE_URL_BASE })
