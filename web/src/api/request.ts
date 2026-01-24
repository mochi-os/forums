// Forums app request helpers
// Uses getAppPath() + '/' as baseURL instead of getApiBasepath()
// This ensures forum IDs in URLs aren't doubled when on forum detail pages

import axios, { type AxiosRequestConfig } from 'axios'
import { getAppPath, getCookie, useAuthStore } from '@mochi/common'

// Create a forums-specific axios instance that uses app path as baseURL
// The common apiClient interceptor overrides baseURL, so we need our own instance
const forumsClient = axios.create({
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
})

forumsClient.interceptors.request.use((config) => {
  // Always use app path as baseURL (class context)
  config.baseURL = getAppPath() + '/'

  // Remove Content-Type for FormData so axios can set the multipart boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }

  // Add auth token
  const storeToken = useAuthStore.getState().token
  const cookieToken = getCookie('token')
  const token = storeToken || cookieToken

  if (token) {
    config.headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`
  }

  return config
})

export const forumsRequest = {
  get: async <TResponse>(
    url: string,
    config?: Omit<AxiosRequestConfig, 'url' | 'method'>
  ): Promise<TResponse> => {
    const response = await forumsClient.get<TResponse>(url, config)
    return response.data
  },

  post: async <TResponse, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: Omit<AxiosRequestConfig<TBody>, 'url' | 'method' | 'data'>
  ): Promise<TResponse> => {
    const response = await forumsClient.post<TResponse>(url, data, config)
    return response.data
  },
}

export default forumsRequest
