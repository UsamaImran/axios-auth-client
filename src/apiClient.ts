import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  CreateAxiosDefaults,
  InternalAxiosRequestConfig,
} from "axios";
import { AuthConfig, QueryParams } from "./types";

type Method = "get" | "post" | "put" | "patch" | "delete";

export class ApiClient {
  private axiosInstance: AxiosInstance;
  private static isRefreshing = false;
  private static refreshSubscribers: ((newToken: string | null) => void)[] = [];

  private readonly authConfig: Required<AuthConfig> & {
    tokenHeader: string;
    expiryThresholdSeconds: number;
  };
  private readonly isPublic: boolean;

  constructor(
    axiosConfig: CreateAxiosDefaults<any> = {},
    authConfig: AuthConfig,
    options: { isPublic?: boolean } = {},
  ) {
    this.isPublic = options.isPublic ?? false;

    this.authConfig = {
      tokenHeader: "Authorization",
      expiryThresholdSeconds: 60,
      sendRefreshTokenInBody: false,
      customRefreshFn: undefined,
      tokenResponsePath: "accessToken",
      ...authConfig,
    } as Required<AuthConfig> & {
      tokenHeader: string;
      expiryThresholdSeconds: number;
    };

    this.axiosInstance = axios.create({
      withCredentials: true,
      ...axiosConfig,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request Interceptor
    this.axiosInstance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        if (this.isPublic) return config;

        let token = this.authConfig.getAccessToken();

        if (token && this.isTokenExpiringSoon(token)) {
          const newToken = await this.refreshAccessToken();
          if (newToken) token = newToken;
        }

        // Proper headers assignment for Axios v1.x
        if (token) {
          config.headers.set(this.authConfig.tokenHeader, token);
        }

        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response Interceptor - Handle 401
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & {
          _retry?: boolean;
        };

        if (
          error.response?.status === 401 &&
          !originalRequest?._retry &&
          !originalRequest?.url?.includes(this.authConfig.refreshTokenEndpoint)
        ) {
          originalRequest._retry = true;
          const newToken = await this.refreshAccessToken();

          if (newToken) {
            originalRequest.headers.set(this.authConfig.tokenHeader, newToken);
            return this.axiosInstance(originalRequest);
          }
        }

        return Promise.reject(error);
      },
    );
  }

  // Universal JWT decoder - works in any JavaScript environment
  private decodeJWT(token: string): Record<string, any> | null {
    try {
      // Get the payload part (second part of the JWT)
      const base64Url = token.split(".")[1];
      if (!base64Url) return null;

      // Convert base64url to base64
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

      // Decode base64 (works in all environments)
      let jsonString: string;

      // Try using atob first (browsers, modern Node.js with --experimental-global)
      if (typeof atob === "function") {
        try {
          jsonString = atob(base64);
        } catch {
          // If atob fails, try the manual approach
          jsonString = this.decodeBase64(base64);
        }
      } else {
        // Fallback to manual decoding
        jsonString = this.decodeBase64(base64);
      }

      return JSON.parse(jsonString);
    } catch (error) {
      console.error("Failed to decode JWT:", error);
      return null;
    }
  }

  // Manual base64 decoder (works everywhere) - FIXED: removed deprecated escape()
  private decodeBase64(base64: string): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let output = "";
    let i = 0;

    while (i < base64.length) {
      const a = chars.indexOf(base64.charAt(i++));
      const b = chars.indexOf(base64.charAt(i++));
      const c = chars.indexOf(base64.charAt(i++));
      const d = chars.indexOf(base64.charAt(i++));

      const bits = (a << 18) | (b << 12) | ((c & 63) << 6) | (d & 63);
      const byte1 = (bits >> 16) & 0xff;
      const byte2 = (bits >> 8) & 0xff;
      const byte3 = bits & 0xff;

      output += String.fromCharCode(byte1);
      if (c !== 64) output += String.fromCharCode(byte2);
      if (d !== 64) output += String.fromCharCode(byte3);
    }

    // JWT payloads are ASCII only, so direct return is safe
    return output;
  }

  private isTokenExpiringSoon(token: string): boolean {
    const payload = this.decodeJWT(token);
    if (!payload) return false;

    const exp = payload.exp as number | undefined;
    if (!exp) return false;

    const currentTime = Math.floor(Date.now() / 1000);
    return (
      exp - currentTime < this.authConfig.expiryThresholdSeconds &&
      exp > currentTime
    );
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (ApiClient.isRefreshing) {
      return new Promise((resolve) =>
        ApiClient.refreshSubscribers.push(resolve),
      );
    }

    ApiClient.isRefreshing = true;

    try {
      const newToken = this.authConfig.customRefreshFn
        ? await this.authConfig.customRefreshFn(this.axiosInstance)
        : await this.defaultRefresh();

      this.authConfig.setAccessToken(newToken);
      this.notifySubscribers(newToken);
      return newToken;
    } catch (error) {
      this.handleRefreshFailure();
      return null;
    } finally {
      ApiClient.isRefreshing = false;
    }
  }

  private async defaultRefresh(): Promise<string> {
    const refreshToken = this.authConfig.getRefreshToken();
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    const payload = this.authConfig.sendRefreshTokenInBody
      ? { refreshToken }
      : {};

    // For refresh request, we need to create headers differently
    const refreshConfig: AxiosRequestConfig = {};

    if (!this.authConfig.sendRefreshTokenInBody) {
      refreshConfig.headers = {
        [this.authConfig.tokenHeader]: refreshToken,
      };
    }

    try {
      const response = await this.axiosInstance.post<any>(
        this.authConfig.refreshTokenEndpoint,
        payload,
        refreshConfig,
      );

      // Extract token using configured path
      let accessToken: string;
      if (this.authConfig.tokenResponsePath) {
        accessToken = this.getNestedValue(
          response.data,
          this.authConfig.tokenResponsePath,
        );
        if (!accessToken) {
          throw new Error(
            `Token not found at path: ${this.authConfig.tokenResponsePath}`,
          );
        }
      } else {
        accessToken = response.data.accessToken;
        if (!accessToken) {
          throw new Error("Response missing accessToken field");
        }
      }

      return accessToken;
    } catch (error) {
      const axiosError = error as AxiosError;
      throw new Error(
        `Token refresh failed: ${axiosError.response?.status || axiosError.message}`,
      );
    }
  }

  private notifySubscribers(newToken: string | null): void {
    ApiClient.refreshSubscribers.forEach((cb) => cb(newToken));
    ApiClient.refreshSubscribers = [];
  }

  private handleRefreshFailure(): void {
    ApiClient.refreshSubscribers.forEach((cb) => cb(null));
    ApiClient.refreshSubscribers = [];
    this.authConfig.removeTokens();
    this.authConfig.onAuthFailure?.();
  }

  // ====================== HTTP Methods ======================

  private async request<T = any, D = any>(
    method: Method,
    url: string,
    data?: D,
    params?: QueryParams,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const res = await this.axiosInstance.request<T>({
      method,
      url,
      data,
      params,
      ...config,
    });
    return res.data;
  }

  get<T = any>(url: string, params?: QueryParams, config?: AxiosRequestConfig) {
    return this.request<T>("get", url, undefined, params, config);
  }

  post<T = any, D = any>(
    url: string,
    data?: D,
    params?: QueryParams,
    config?: AxiosRequestConfig,
  ) {
    return this.request<T>("post", url, data, params, config);
  }

  put<T = any, D = any>(
    url: string,
    data?: D,
    params?: QueryParams,
    config?: AxiosRequestConfig,
  ) {
    return this.request<T>("put", url, data, params, config);
  }

  patch<T = any, D = any>(
    url: string,
    data?: D,
    params?: QueryParams,
    config?: AxiosRequestConfig,
  ) {
    return this.request<T>("patch", url, data, params, config);
  }

  delete<T = any>(
    url: string,
    params?: QueryParams,
    config?: AxiosRequestConfig,
  ) {
    return this.request<T>("delete", url, undefined, params, config);
  }

  updateDefaultHeaders(headers: Record<string, string>): void {
    // For Axios v1.x, use set method
    Object.entries(headers).forEach(([key, value]) => {
      this.axiosInstance.defaults.headers.common[key] = value;
    });
  }

  getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }
}
