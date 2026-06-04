import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  CreateAxiosDefaults,
} from "axios";
import { AuthConfig, QueryParams } from "./types";
import { JwtDecoder } from "./jwt/jwtDecoder";
import { TokenManager } from "./jwt/tokenManager";
import { AuthInterceptor } from "./interceptors/authInterceptor";

type Method = "get" | "post" | "put" | "patch" | "delete";

export class ApiClient {
  private axiosInstance: AxiosInstance;
  private tokenManager: TokenManager;
  private jwtDecoder: JwtDecoder;

  constructor(
    axiosConfig: CreateAxiosDefaults<any> = {},
    authConfig: AuthConfig,
    options: { isPublic?: boolean } = {},
  ) {
    const isPublic = options.isPublic ?? false;

    const fullAuthConfig = {
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

    // Inject dependencies
    this.jwtDecoder = new JwtDecoder();
    this.tokenManager = new TokenManager(fullAuthConfig, this.axiosInstance);

    // Setup interceptors with injected dependencies
    const authInterceptor = new AuthInterceptor(
      this.axiosInstance,
      fullAuthConfig,
      this.tokenManager,
      this.jwtDecoder,
      isPublic,
    );
    authInterceptor.setup();
  }

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

  get<T = any>(
    url: string,
    params?: QueryParams,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return this.request<T>("get", url, undefined, params, config);
  }

  post<T = any, D = any>(
    url: string,
    data?: D,
    params?: QueryParams,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return this.request<T>("post", url, data, params, config);
  }

  put<T = any, D = any>(
    url: string,
    data?: D,
    params?: QueryParams,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return this.request<T>("put", url, data, params, config);
  }

  patch<T = any, D = any>(
    url: string,
    data?: D,
    params?: QueryParams,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return this.request<T>("patch", url, data, params, config);
  }

  delete<T = any>(
    url: string,
    params?: QueryParams,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return this.request<T>("delete", url, undefined, params, config);
  }

  updateDefaultHeaders(headers: Record<string, string>): void {
    Object.entries(headers).forEach(([key, value]) => {
      this.axiosInstance.defaults.headers.common[key] = value;
    });
  }

  getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }
}
