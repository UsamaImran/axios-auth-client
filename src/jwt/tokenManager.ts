import { AxiosInstance, AxiosRequestConfig } from "axios";
import { AuthConfig } from "../types";

interface RefreshRequestConfig extends AxiosRequestConfig {
  _skipAuthRefresh?: boolean;
}

export class TokenManager {
  private refreshPromise: Promise<string> | null = null;

  constructor(
    private authConfig: Required<AuthConfig> & {
      tokenHeader: string;
      expiryThresholdSeconds: number;
    },
    private axiosInstance: AxiosInstance,
  ) {}

  refreshToken(): Promise<string> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this.performRefresh()
      .then((newToken) => {
        this.authConfig.setAccessToken(newToken);
        return newToken;
      })
      .catch((error: unknown) => {
        this.handleRefreshFailure();
        throw error;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  private async performRefresh(): Promise<string> {
    if (this.authConfig.customRefreshFn) {
      return this.authConfig.customRefreshFn(this.axiosInstance);
    }

    return this.defaultRefresh();
  }

  private async defaultRefresh(): Promise<string> {
    const refreshToken = this.authConfig.getRefreshToken();
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    const payload = this.authConfig.sendRefreshTokenInBody
      ? { refreshToken }
      : {};

    const refreshConfig: RefreshRequestConfig = {
      _skipAuthRefresh: true,
    };

    if (!this.authConfig.sendRefreshTokenInBody) {
      refreshConfig.headers = {
        [this.authConfig.tokenHeader]: refreshToken,
      };
    }

    const response = await this.axiosInstance.post<unknown>(
      this.authConfig.refreshTokenEndpoint,
      payload,
      refreshConfig,
    );

    const path = this.authConfig.tokenResponsePath || "accessToken";
    const accessToken = this.getNestedValue(response.data, path);

    if (typeof accessToken !== "string" || !accessToken) {
      throw new Error(`Token not found at path: ${path}`);
    }

    return accessToken;
  }

  private getNestedValue(value: unknown, path: string): unknown {
    return path.split(".").reduce<unknown>((current, key) => {
      if (current === null || typeof current !== "object") return undefined;
      return (current as Record<string, unknown>)[key];
    }, value);
  }

  private handleRefreshFailure(): void {
    this.authConfig.removeTokens();
    this.authConfig.onAuthFailure?.();
  }
}
