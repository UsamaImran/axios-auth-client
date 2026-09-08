import axios, { AxiosInstance } from "axios";
import { TokenManager } from "../../jwt/tokenManager";
import { NEW_ACCESS_TOKEN, REFRESH_TOKEN, createMockAuthConfig } from "../setup";

describe("TokenManager", () => {
  let axiosInstance: AxiosInstance;

  beforeEach(() => {
    axiosInstance = axios.create();
  });

  it("should share one in-flight refresh promise", async () => {
    let resolveRefresh!: (token: string) => void;
    const customRefreshFn = jest.fn(
      () => new Promise<string>((resolve) => (resolveRefresh = resolve)),
    );
    const authConfig = createMockAuthConfig({ customRefreshFn });
    const manager = new TokenManager(authConfig, axiosInstance);

    const first = manager.refreshToken();
    const second = manager.refreshToken();

    expect(first).toBe(second);
    expect(customRefreshFn).toHaveBeenCalledTimes(1);

    resolveRefresh(NEW_ACCESS_TOKEN);

    await expect(first).resolves.toBe(NEW_ACCESS_TOKEN);
    expect(authConfig.setAccessToken).toHaveBeenCalledWith(NEW_ACCESS_TOKEN);
  });

  it("should reject all callers and clear auth state when refresh fails", async () => {
    const failure = new Error("refresh failed");
    const customRefreshFn = jest.fn(async () => {
      throw failure;
    });
    const authConfig = createMockAuthConfig({ customRefreshFn });
    const manager = new TokenManager(authConfig, axiosInstance);

    const [first, second] = [manager.refreshToken(), manager.refreshToken()];

    await expect(first).rejects.toBe(failure);
    await expect(second).rejects.toBe(failure);
    expect(authConfig.removeTokens).toHaveBeenCalledTimes(1);
    expect(authConfig.onAuthFailure).toHaveBeenCalledTimes(1);
    expect(customRefreshFn).toHaveBeenCalledTimes(1);
  });

  it("should send refresh token in the Authorization header by default", async () => {
    const authConfig = createMockAuthConfig();
    const manager = new TokenManager(authConfig, axiosInstance);
    jest.spyOn(axiosInstance, "post").mockResolvedValue({
      data: { accessToken: NEW_ACCESS_TOKEN },
    } as any);

    await expect(manager.refreshToken()).resolves.toBe(NEW_ACCESS_TOKEN);
    expect(axiosInstance.post).toHaveBeenCalledWith(
      "/auth/refresh",
      {},
      expect.objectContaining({
        headers: { Authorization: REFRESH_TOKEN },
        _skipAuthRefresh: true,
      }),
    );
  });

  it("should extract a nested access token when configured", async () => {
    const authConfig = createMockAuthConfig({
      tokenResponsePath: "data.token",
    });
    const manager = new TokenManager(authConfig, axiosInstance);
    jest.spyOn(axiosInstance, "post").mockResolvedValue({
      data: { data: { token: NEW_ACCESS_TOKEN } },
    } as any);

    await expect(manager.refreshToken()).resolves.toBe(NEW_ACCESS_TOKEN);
  });
});
