import { AxiosResponse } from "axios";
import { VALID_ACCESS_TOKEN, NEW_ACCESS_TOKEN } from "../setup";
import { AuthInterceptor } from "../../interceptors/authInterceptor";
import { JwtDecoder } from "../../jwt/jwtDecoder";
import { TokenManager } from "../../jwt/tokenManager";

describe("AuthInterceptor", () => {
  let mockAxiosInstance: any; // Use any to allow callable
  let mockTokenManager: jest.Mocked<TokenManager>;
  let mockJwtDecoder: jest.Mocked<JwtDecoder>;
  let mockAuthConfig: any;

  // Store interceptor functions
  let requestInterceptorFn: ((config: any) => any) | null = null;
  let responseInterceptorFn: ((response: any) => any) | null = null;
  let responseErrorInterceptorFn: ((error: any) => any) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset stored functions
    requestInterceptorFn = null;
    responseInterceptorFn = null;
    responseErrorInterceptorFn = null;

    // Create a callable function for axios instance
    const axiosCallable = jest.fn();

    // Create mock axios instance as a callable function with properties
    mockAxiosInstance = axiosCallable;

    // Add all the properties needed for AxiosInstance
    Object.assign(mockAxiosInstance, {
      interceptors: {
        request: {
          use: jest.fn().mockImplementation((successFn) => {
            requestInterceptorFn = successFn;
            return 0;
          }),
          eject: jest.fn(),
          clear: jest.fn(),
        },
        response: {
          use: jest.fn().mockImplementation((successFn, errorFn) => {
            responseInterceptorFn = successFn;
            responseErrorInterceptorFn = errorFn;
            return 0;
          }),
          eject: jest.fn(),
          clear: jest.fn(),
        },
      },
      defaults: { headers: { common: {} } },
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      request: jest.fn(),
      getUri: jest.fn(),
      head: jest.fn(),
      options: jest.fn(),
      create: jest.fn(),
    });

    mockTokenManager = {
      refreshToken: jest.fn(),
    } as any;

    mockJwtDecoder = {
      decode: jest.fn(),
      isTokenExpiringSoon: jest.fn(),
    } as any;

    mockAuthConfig = {
      tokenHeader: "Authorization",
      expiryThresholdSeconds: 60,
      refreshTokenEndpoint: "/auth/refresh",
      getAccessToken: jest.fn(() => VALID_ACCESS_TOKEN),
    };
  });

  describe("setup with authentication", () => {
    beforeEach(() => {
      const interceptor = new AuthInterceptor(
        mockAxiosInstance,
        mockAuthConfig,
        mockTokenManager,
        mockJwtDecoder,
        false,
      );
      interceptor.setup();
    });

    it("should add token to request when token exists", async () => {
      expect(requestInterceptorFn).not.toBeNull();

      const config = { headers: { set: jest.fn() } } as any;
      mockJwtDecoder.isTokenExpiringSoon.mockReturnValue(false);

      const result = await requestInterceptorFn!(config);

      expect(config.headers.set).toHaveBeenCalledWith(
        "Authorization",
        VALID_ACCESS_TOKEN,
      );
      expect(result).toBe(config);
    });

    it("should proactively refresh token when expiring soon", async () => {
      expect(requestInterceptorFn).not.toBeNull();

      const config = { headers: { set: jest.fn() } } as any;
      mockJwtDecoder.isTokenExpiringSoon.mockReturnValue(true);
      mockTokenManager.refreshToken.mockResolvedValue(NEW_ACCESS_TOKEN);

      const result = await requestInterceptorFn!(config);

      expect(mockTokenManager.refreshToken).toHaveBeenCalled();
      expect(config.headers.set).toHaveBeenCalledWith(
        "Authorization",
        NEW_ACCESS_TOKEN,
      );
      expect(result).toBe(config);
    });

    it("should not add token when getAccessToken returns null", async () => {
      expect(requestInterceptorFn).not.toBeNull();

      const config = { headers: { set: jest.fn() } } as any;
      mockAuthConfig.getAccessToken.mockReturnValue(null);
      mockJwtDecoder.isTokenExpiringSoon.mockReturnValue(false);

      const result = await requestInterceptorFn!(config);

      expect(config.headers.set).not.toHaveBeenCalled();
      expect(result).toBe(config);
    });

    it("should handle refresh returning null (no token added)", async () => {
      expect(requestInterceptorFn).not.toBeNull();

      const config = { headers: { set: jest.fn() } } as any;
      mockJwtDecoder.isTokenExpiringSoon.mockReturnValue(true);
      mockTokenManager.refreshToken.mockResolvedValue(null);
      mockAuthConfig.getAccessToken.mockReturnValue(VALID_ACCESS_TOKEN);

      const result = await requestInterceptorFn!(config);

      // When refresh returns null, the original token is still used
      expect(config.headers.set).toHaveBeenCalledWith(
        "Authorization",
        VALID_ACCESS_TOKEN,
      );
      expect(result).toBe(config);
    });

    it("should retry request after 401 and refresh", async () => {
      expect(responseErrorInterceptorFn).not.toBeNull();

      const originalRequest = {
        headers: { set: jest.fn() },
        url: "/test",
        _retry: false,
      } as any;

      const error = {
        response: { status: 401 },
        config: originalRequest,
      };

      mockTokenManager.refreshToken.mockResolvedValue(NEW_ACCESS_TOKEN);

      // Mock the axios instance call to return a successful response on retry
      const mockRetryResponse = { data: "success" };
      mockAxiosInstance.mockResolvedValue(mockRetryResponse);

      const result = await responseErrorInterceptorFn!(error);

      expect(originalRequest._retry).toBe(true);
      expect(originalRequest.headers.set).toHaveBeenCalledWith(
        "Authorization",
        NEW_ACCESS_TOKEN,
      );
      expect(mockAxiosInstance).toHaveBeenCalledWith(originalRequest);
      expect(result).toEqual(mockRetryResponse);
    });

    it("should not retry when refresh returns null", async () => {
      expect(responseErrorInterceptorFn).not.toBeNull();

      const originalRequest = {
        headers: { set: jest.fn() },
        url: "/test",
        _retry: false,
      } as any;

      const error = {
        response: { status: 401 },
        config: originalRequest,
      };

      mockTokenManager.refreshToken.mockResolvedValue(null);

      await expect(responseErrorInterceptorFn!(error)).rejects.toEqual(error);
      expect(originalRequest.headers.set).not.toHaveBeenCalled();
    });

    it("should not retry on refresh endpoint", async () => {
      expect(responseErrorInterceptorFn).not.toBeNull();

      const originalRequest = {
        headers: { set: jest.fn() },
        url: "/auth/refresh",
        _retry: false,
      } as any;

      const error = {
        response: { status: 401 },
        config: originalRequest,
      };

      await expect(responseErrorInterceptorFn!(error)).rejects.toEqual(error);
      expect(mockTokenManager.refreshToken).not.toHaveBeenCalled();
    });

    it("should not retry when already retried", async () => {
      expect(responseErrorInterceptorFn).not.toBeNull();

      const originalRequest = {
        headers: { set: jest.fn() },
        url: "/test",
        _retry: true,
      } as any;

      const error = {
        response: { status: 401 },
        config: originalRequest,
      };

      await expect(responseErrorInterceptorFn!(error)).rejects.toEqual(error);
      expect(mockTokenManager.refreshToken).not.toHaveBeenCalled();
    });

    it("should pass through successful responses", async () => {
      expect(responseInterceptorFn).not.toBeNull();

      const response = { data: "success", status: 200 } as AxiosResponse;
      const result = await responseInterceptorFn!(response);
      expect(result).toBe(response);
    });

    it("should pass through non-401 errors", async () => {
      expect(responseErrorInterceptorFn).not.toBeNull();

      const error = {
        response: { status: 500 },
        config: { url: "/test" },
      };

      await expect(responseErrorInterceptorFn!(error)).rejects.toEqual(error);
      expect(mockTokenManager.refreshToken).not.toHaveBeenCalled();
    });
  });

  describe("setup with public client", () => {
    beforeEach(() => {
      const interceptor = new AuthInterceptor(
        mockAxiosInstance,
        mockAuthConfig,
        mockTokenManager,
        mockJwtDecoder,
        true,
      );
      interceptor.setup();
    });

    it("should not add token for public client", async () => {
      expect(requestInterceptorFn).not.toBeNull();

      const config = { headers: { set: jest.fn() } } as any;

      const result = await requestInterceptorFn!(config);

      expect(mockAuthConfig.getAccessToken).not.toHaveBeenCalled();
      expect(config.headers.set).not.toHaveBeenCalled();
      expect(result).toBe(config);
    });
  });
});
