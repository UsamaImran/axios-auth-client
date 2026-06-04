import {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosError,
  AxiosResponse,
} from "axios";
import { TokenManager } from "../jwt/tokenManager";
import { JwtDecoder } from "../jwt/jwtDecoder";

interface AuthConfig {
  tokenHeader: string;
  expiryThresholdSeconds: number;
  refreshTokenEndpoint: string;
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
      async (config: InternalAxiosRequestConfig) => {
        if (this.isPublic) return config;

        let token = this.authConfig.getAccessToken();

        if (
          token &&
          this.jwtDecoder.isTokenExpiringSoon(
            token,
            this.authConfig.expiryThresholdSeconds,
          )
        ) {
          const newToken = await this.tokenManager.refreshToken();
          if (newToken) token = newToken;
        }

        if (token) {
          config.headers.set(this.authConfig.tokenHeader, token);
        }

        return config;
      },
      (error) => Promise.reject(error),
    );
  }

  private setupResponseInterceptor(): void {
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
          const newToken = await this.tokenManager.refreshToken();

          if (newToken) {
            originalRequest.headers.set(this.authConfig.tokenHeader, newToken);
            return this.axiosInstance(originalRequest);
          }
        }

        return Promise.reject(error);
      },
    );
  }
}
