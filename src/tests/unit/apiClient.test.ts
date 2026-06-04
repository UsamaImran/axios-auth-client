import axios, { AxiosInstance } from "axios";
import { createMockAuthConfig } from "../setup";
import { ApiClient } from "../../apiClient";

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
  });

  describe("authentication integration", () => {
    it("should work with valid auth config", async () => {
      const client = new ApiClient({}, mockAuthConfig);
      expect(client).toBeDefined();

      // Verify interceptors were set up
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });

    it("should create public client when isPublic is true", () => {
      const client = new ApiClient({}, mockAuthConfig, { isPublic: true });
      expect(client).toBeDefined();
    });
  });
});
