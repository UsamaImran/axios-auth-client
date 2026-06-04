import { ApiClient } from "../apiClient";
import {
  createMockAuthConfig,
  VALID_BASE64,
  VALID_BASE64URL,
  JSON_BASE64,
} from "./setup";

describe("Base64 decoding", () => {
  let client: ApiClient;

  beforeEach(() => {
    const mockAuthConfig = createMockAuthConfig();
    client = new ApiClient({}, mockAuthConfig);
  });

  it("should decode standard base64 strings", () => {
    const decoded = (client as any).decodeBase64(VALID_BASE64);
    expect(decoded).toBe("Hello World");
  });

  it("should handle base64 with padding", () => {
    const decoded = (client as any).decodeBase64("QUJD"); // "ABC"
    expect(decoded).toBe("ABC");
  });

  it("should handle base64url format", () => {
    const decoded = (client as any).decodeBase64(VALID_BASE64URL);
    expect(decoded).toBe("Hello-World?");
  });

  it("should handle empty string", () => {
    const decoded = (client as any).decodeBase64("");
    expect(decoded).toBe("");
  });

  it("should handle complex JSON payloads", () => {
    const decoded = (client as any).decodeBase64(JSON_BASE64);
    expect(JSON.parse(decoded)).toEqual({
      test: "data",
      nested: { value: 123 },
    });
  });
});
