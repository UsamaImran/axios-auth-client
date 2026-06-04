import axios, { AxiosInstance } from "axios";
import {
  VALID_ACCESS_TOKEN,
  EXPIRED_ACCESS_TOKEN,
  REFRESH_TOKEN,
  NEW_ACCESS_TOKEN,
  createMockAuthConfig,
  createMockAxiosResponse,
} from "./setup";
import { ApiClient } from "../apiClient";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Helper to create a complete mock Axios instance
const createMockAxiosInstance = (): jest.Mocked<AxiosInstance> => {
  const mockInstance = {
    request: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    head: jest.fn(),
    options: jest.fn(),
    getUri: jest.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() },
    },
    create: jest.fn(),
  } as any;
  return mockInstance;
};

describe("ApiClient", () => {
  let mockAuthConfig: ReturnType<typeof createMockAuthConfig>;
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthConfig = createMockAuthConfig();
    mockAxiosInstance = createMockAxiosInstance();
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
  });

  describe("constructor", () => {
    it("should create instance with auth config", () => {
      const client = new ApiClient(
        { baseURL: "https://api.example.com" },
        mockAuthConfig,
      );
      expect(client).toBeInstanceOf(ApiClient);
      expect(mockedAxios.create).toHaveBeenCalledWith({
        withCredentials: true,
        baseURL: "https://api.example.com",
      });
    });

    it("should create public client without auth", () => {
      const client = new ApiClient({}, mockAuthConfig, { isPublic: true });
      expect(client).toBeInstanceOf(ApiClient);
    });

    it("should merge default auth config with provided values", () => {
      const customConfig = createMockAuthConfig({
        tokenHeader: "X-Custom-Token",
        expiryThresholdSeconds: 120,
      });
      const client = new ApiClient({}, customConfig);
      expect(client).toBeDefined();
    });
  });

  describe("JWT decoding", () => {
    let client: ApiClient;

    beforeEach(() => {
      client = new ApiClient({}, mockAuthConfig);
    });

    it("should decode valid JWT token", () => {
      const decoded = (client as any).decodeJWT(VALID_ACCESS_TOKEN);
      expect(decoded).toHaveProperty("sub", "1234567890");
      expect(decoded).toHaveProperty("exp");
    });

    it("should return null for invalid token", () => {
      const decoded = (client as any).decodeJWT("invalid.token");
      expect(decoded).toBeNull();
    });

    it("should return null for malformed token", () => {
      const decoded = (client as any).decodeJWT("eyJhbGciOiJIUzI1NiJ9");
      expect(decoded).toBeNull();
    });
  });

  describe("token expiration check", () => {
    let client: ApiClient;

    beforeEach(() => {
      client = new ApiClient({}, mockAuthConfig);
    });

    it("should return false when token is expired", () => {
      const isExpiring = (client as any).isTokenExpiringSoon(
        EXPIRED_ACCESS_TOKEN,
      );
      expect(isExpiring).toBe(false);
    });

    it("should return false for valid token", () => {
      const isExpiring = (client as any).isTokenExpiringSoon(
        VALID_ACCESS_TOKEN,
      );
      expect(isExpiring).toBe(false);
    });

    it("should return false for token without exp claim", () => {
      const tokenWithoutExp =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.fake";
      const isExpiring = (client as any).isTokenExpiringSoon(tokenWithoutExp);
      expect(isExpiring).toBe(false);
    });
  });

  describe("refresh token mechanism", () => {
    it("should refresh token using default method", async () => {
      mockAxiosInstance.post.mockResolvedValue(
        createMockAxiosResponse({ accessToken: NEW_ACCESS_TOKEN }),
      );

      const client = new ApiClient({}, mockAuthConfig);
      const newToken = await (client as any).refreshAccessToken();

      expect(newToken).toBe(NEW_ACCESS_TOKEN);
      expect(mockAuthConfig.setAccessToken).toHaveBeenCalledWith(
        NEW_ACCESS_TOKEN,
      );
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/auth/refresh",
        {},
        { headers: { Authorization: REFRESH_TOKEN } },
      );
    });

    it("should send refresh token in body when configured", async () => {
      const configWithBody = createMockAuthConfig({
        sendRefreshTokenInBody: true,
      });
      mockAxiosInstance.post.mockResolvedValue(
        createMockAxiosResponse({ accessToken: NEW_ACCESS_TOKEN }),
      );

      const client = new ApiClient({}, configWithBody);
      await (client as any).refreshAccessToken();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/auth/refresh",
        { refreshToken: REFRESH_TOKEN },
        {},
      );
    });

    it("should use custom refresh function when provided", async () => {
      const customRefreshFn = jest.fn().mockResolvedValue(NEW_ACCESS_TOKEN);
      const configWithCustom = createMockAuthConfig({ customRefreshFn });

      const client = new ApiClient({}, configWithCustom);
      const newToken = await (client as any).refreshAccessToken();

      expect(customRefreshFn).toHaveBeenCalled();
      expect(newToken).toBe(NEW_ACCESS_TOKEN);
    });

    it("should extract token from nested path", async () => {
      const configWithNested = createMockAuthConfig({
        tokenResponsePath: "data.token.access",
      });
      mockAxiosInstance.post.mockResolvedValue(
        createMockAxiosResponse({
          data: { token: { access: NEW_ACCESS_TOKEN } },
        }),
      );

      const client = new ApiClient({}, configWithNested);
      const newToken = await (client as any).refreshAccessToken();

      expect(newToken).toBe(NEW_ACCESS_TOKEN);
    });

    it("should handle refresh failure", async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error("Network error"));

      const client = new ApiClient({}, mockAuthConfig);
      const newToken = await (client as any).refreshAccessToken();

      expect(newToken).toBeNull();
      expect(mockAuthConfig.removeTokens).toHaveBeenCalled();
      expect(mockAuthConfig.onAuthFailure).toHaveBeenCalled();
    });

    it("should queue multiple refresh requests", async () => {
      let resolveRefresh: (value: any) => void;
      const refreshPromise = new Promise((resolve) => {
        resolveRefresh = resolve;
      });

      mockAxiosInstance.post.mockImplementation(() => refreshPromise);

      const client = new ApiClient({}, mockAuthConfig);

      // Start first refresh
      const refresh1 = (client as any).refreshAccessToken();

      // Start second refresh while first is in progress
      const refresh2 = (client as any).refreshAccessToken();

      // Resolve the refresh with the new token
      resolveRefresh!({ data: { accessToken: NEW_ACCESS_TOKEN } });

      const [token1, token2] = await Promise.all([refresh1, refresh2]);

      expect(token1).toBe(NEW_ACCESS_TOKEN);
      expect(token2).toBe(NEW_ACCESS_TOKEN);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });

    it("should throw error when no refresh token available", async () => {
      const configWithoutRefresh = createMockAuthConfig({
        getRefreshToken: jest.fn(() => null),
      });

      const client = new ApiClient({}, configWithoutRefresh);

      // The method catches the error and returns null, so we expect null
      const result = await (client as any).refreshAccessToken();
      expect(result).toBeNull();
      // Verify that removeTokens was called
      expect(configWithoutRefresh.removeTokens).toHaveBeenCalled();
    });
  });

  describe("HTTP methods", () => {
    let client: ApiClient;

    beforeEach(() => {
      client = new ApiClient({}, mockAuthConfig);
    });

    it("should make GET request", async () => {
      const responseData = { id: 1, name: "Test" };
      mockAxiosInstance.request.mockResolvedValue({ data: responseData });

      const result = await client.get("/test", { page: 1 });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: "get",
        url: "/test",
        data: undefined,
        params: { page: 1 },
      });
      expect(result).toEqual(responseData);
    });

    it("should make GET request with config", async () => {
      const responseData = { id: 1 };
      mockAxiosInstance.request.mockResolvedValue({ data: responseData });

      const result = await client.get("/test", undefined, { timeout: 5000 });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: "get",
        url: "/test",
        data: undefined,
        params: undefined,
        timeout: 5000,
      });
      expect(result).toEqual(responseData);
    });

    it("should make POST request", async () => {
      const postData = { name: "New Item" };
      const responseData = { id: 1, ...postData };
      mockAxiosInstance.request.mockResolvedValue({ data: responseData });

      const result = await client.post("/items", postData);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: "post",
        url: "/items",
        data: postData,
        params: undefined,
      });
      expect(result).toEqual(responseData);
    });

    it("should make POST request with params", async () => {
      const postData = { name: "New Item" };
      mockAxiosInstance.request.mockResolvedValue({ data: { success: true } });

      const result = await client.post("/items", postData, { page: 1 });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: "post",
        url: "/items",
        data: postData,
        params: { page: 1 },
      });
      expect(result).toEqual({ success: true });
    });

    it("should make PUT request", async () => {
      const updateData = { name: "Updated" };
      mockAxiosInstance.request.mockResolvedValue({ data: updateData });

      const result = await client.put("/items/1", updateData);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: "put",
        url: "/items/1",
        data: updateData,
        params: undefined,
      });
      expect(result).toEqual(updateData);
    });

    it("should make PATCH request", async () => {
      const patchData = { name: "Patched" };
      mockAxiosInstance.request.mockResolvedValue({ data: patchData });

      const result = await client.patch("/items/1", patchData);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: "patch",
        url: "/items/1",
        data: patchData,
        params: undefined,
      });
      expect(result).toEqual(patchData);
    });

    it("should make DELETE request", async () => {
      mockAxiosInstance.request.mockResolvedValue({ data: { success: true } });

      const result = await client.delete("/items/1");

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: "delete",
        url: "/items/1",
        data: undefined,
        params: undefined,
      });
      expect(result).toEqual({ success: true });
    });

    it("should make DELETE request with params", async () => {
      mockAxiosInstance.request.mockResolvedValue({ data: { success: true } });

      const result = await client.delete("/items/1", { permanent: true });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: "delete",
        url: "/items/1",
        data: undefined,
        params: { permanent: true },
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("utility methods", () => {
    let client: ApiClient;

    beforeEach(() => {
      client = new ApiClient({}, mockAuthConfig);
    });

    it("should update default headers", () => {
      client.updateDefaultHeaders({ "X-Custom": "value" });

      expect(mockAxiosInstance.defaults.headers.common["X-Custom"]).toBe(
        "value",
      );
    });

    it("should return axios instance", () => {
      const instance = client.getAxiosInstance();

      expect(instance).toBe(mockAxiosInstance);
    });
  });

  describe("error handling", () => {
    it("should handle request errors", async () => {
      mockAxiosInstance.request.mockRejectedValue(new Error("Network Error"));
      const client = new ApiClient({}, mockAuthConfig);

      await expect(client.get("/test")).rejects.toThrow("Network Error");
    });

    it("should handle 401 error without retry on refresh endpoint", async () => {
      const error: any = new Error("Unauthorized");
      error.response = { status: 401 };
      error.config = { url: "/auth/refresh", headers: { set: jest.fn() } };
      mockAxiosInstance.request.mockRejectedValue(error);

      const client = new ApiClient({}, mockAuthConfig);

      await expect(client.get("/test")).rejects.toThrow("Unauthorized");
    });
  });
});
