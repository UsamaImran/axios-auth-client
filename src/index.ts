// Export the main ApiClient class
export { ApiClient } from "./apiClient";

// Export all types for users to use
export type {
  AuthConfig,
  QueryParams,
  ApiClientOptions,
  RefreshSubscriber,
} from "./types";

// Re-export commonly used Axios types for convenience
export type {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  CreateAxiosDefaults,
} from "axios";
