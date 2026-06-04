// Valid JWT tokens for testing
export const VALID_ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE3OTk5OTk5OTl9.fake_signature";
export const EXPIRED_ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OX0.fake_signature";
export const REFRESH_TOKEN = "valid_refresh_token";
export const NEW_ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE3OTk5OTk5OTl9.new_token_signature";

// Helper to create mock auth config
export const createMockAuthConfig = (overrides: any = {}) => ({
  getAccessToken: jest.fn(() => VALID_ACCESS_TOKEN),
  getRefreshToken: jest.fn(() => REFRESH_TOKEN),
  setAccessToken: jest.fn(),
  removeTokens: jest.fn(),
  refreshTokenEndpoint: "/auth/refresh",
  onAuthFailure: jest.fn(),
  tokenHeader: "Authorization",
  expiryThresholdSeconds: 60,
  sendRefreshTokenInBody: false,
  tokenResponsePath: "accessToken",
  ...overrides,
});

// Helper to create mock axios response
export const createMockAxiosResponse = (data: any, status = 200) => ({
  data,
  status,
  statusText: "OK",
  headers: {},
  config: { headers: {} as any },
});

// Helper to create mock axios error
export const createMockAxiosError = (
  status: number,
  config: any = { headers: {} },
) => {
  const error: any = new Error("Request failed");
  error.response = { status, data: {}, headers: {}, config };
  error.config = config;
  return error;
};

export const VALID_BASE64 = "SGVsbG8gV29ybGQ=";
export const VALID_BASE64URL = "SGVsbG8tV29ybGQ_"; // "Hello-World?"
export const JSON_BASE64 =
  "eyJ0ZXN0IjoiZGF0YSIsIm5lc3RlZCI6eyJ2YWx1ZSI6MTIzfX0="; // {"test":"data","nested":{"value":123}}
