import { AxiosInstance } from "axios";
import { AuthConfig } from "../types";

export class TokenManager {
  private isRefreshing = false;
  private refreshSubscribers: ((newToken: string | null) => void)[] = [];

  constructor(
    private authConfig: Required<AuthConfig> & {
      tokenHeader: string;
      expiryThresholdSeconds: number;
    },
    private axiosInstance: AxiosInstance,
  ) {}

  async refreshToken(): Promise<string | null> {
    if (this.isRefreshing) {
      return new Promise((resolve) => this.refreshSubscribers.push(resolve));
    }

    this.isRefreshing = true;

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
      this.isRefreshing = false;
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

    const refreshConfig: any = {};

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
    } catch (error: any) {
      throw new Error(
        `Token refresh failed: ${error.response?.status || error.message}`,
      );
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  private notifySubscribers(newToken: string | null): void {
    this.refreshSubscribers.forEach((cb) => cb(newToken));
    this.refreshSubscribers = [];
  }

  private handleRefreshFailure(): void {
    this.refreshSubscribers.forEach((cb) => cb(null));
    this.refreshSubscribers = [];
    this.authConfig.removeTokens();
    this.authConfig.onAuthFailure?.();
  }
}
