import {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { TokenManager } from "../jwt/tokenManager";
import { JwtDecoder } from "../jwt/jwtDecoder";

interface AuthRequestConfig extends InternalAxiosRequestConfig {
  _authToken?: string | null;
  _retry?: boolean;
  _skipAuthRefresh?: boolean;
}

interface AuthConfig {
  tokenHeader: string;
  expiryThresholdSeconds: number;
  getAccessToken: () => string | null;
}

export class AuthInterceptor {
  constructor(
    private axiosInstance: AxiosInstance,
    private authConfig: AuthConfig,
    private tokenManager: TokenManager,
    private jwtDecoder: JwtDecoder,
    private isPublic: boolean,
  ) {}

  setup(): void {
    this.setupRequestInterceptor();
    this.setupResponseInterceptor();
  }

  private setupRequestInterceptor(): void {
    this.axiosInstance.interceptors.request.use(
      async (config: AuthRequestConfig) => {
        if (this.isPublic || config._skipAuthRefresh) return config;

        let token = this.authConfig.getAccessToken();

        if (
          token &&
          this.jwtDecoder.isTokenExpiringSoon(
            token,
            this.authConfig.expiryThresholdSeconds,
          )
        ) {
          token = await this.tokenManager.refreshToken();
        }

        if (token) {
          config.headers.set(this.authConfig.tokenHeader, token);
        }
        config._authToken = token;

        return config;
      },
      (error) => Promise.reject(error),
    );
  }

  private setupResponseInterceptor(): void {
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AuthRequestConfig | undefined;

        if (
          this.isPublic ||
          originalRequest?._skipAuthRefresh ||
          error.response?.status !== 401 ||
          !originalRequest ||
          originalRequest._retry
        ) {
          return Promise.reject(error);
        }

        const currentToken = this.authConfig.getAccessToken();
        if (currentToken && currentToken !== originalRequest._authToken) {
          originalRequest.headers.set(this.authConfig.tokenHeader, currentToken);
          originalRequest._retry = true;
          return this.axiosInstance(originalRequest);
        }

        originalRequest._retry = true;

        const newToken = await this.tokenManager.refreshToken();
        originalRequest.headers.set(this.authConfig.tokenHeader, newToken);
        originalRequest._authToken = newToken;
        return this.axiosInstance(originalRequest);
      },
    );
  }
}
