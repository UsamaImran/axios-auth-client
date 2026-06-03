import { AxiosInstance } from "axios";

export interface AuthConfig {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setAccessToken: (token: string) => void;
  removeTokens: () => void;
  refreshTokenEndpoint: string;
  onAuthFailure?: () => void;
  tokenHeader?: string;
  expiryThresholdSeconds?: number;
  customRefreshFn?: (instance: AxiosInstance) => Promise<string>;
  sendRefreshTokenInBody?: boolean;
  tokenResponsePath?: string; // Path to accessToken in response (e.g., "data.token" or "accessToken")
}

export type QueryParams = string | Record<string, any> | string[][] | undefined;

export interface ApiClientOptions {
  isPublic?: boolean;
}

export interface RefreshSubscriber {
  (newToken: string | null): void;
}
