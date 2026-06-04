import { JwtDecoder } from "../../jwt/jwtDecoder";

describe("JwtDecoder", () => {
  let jwtDecoder: JwtDecoder;

  beforeEach(() => {
    jwtDecoder = new JwtDecoder();
    // Suppress console.error for tests that expect null
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("decode", () => {
    it("should decode valid JWT token", () => {
      // Create a valid token for testing
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const payload = { sub: "1234567890", name: "John Doe", exp };
      const base64Payload = Buffer.from(JSON.stringify(payload)).toString(
        "base64",
      );
      const validToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${base64Payload}.signature`;

      const decoded = jwtDecoder.decode(validToken);
      expect(decoded).toHaveProperty("sub", "1234567890");
      expect(decoded).toHaveProperty("name", "John Doe");
    });

    it("should return null for invalid token", () => {
      const decoded = jwtDecoder.decode("invalid.token");
      expect(decoded).toBeNull();
    });

    it("should return null for malformed token", () => {
      const decoded = jwtDecoder.decode("eyJhbGciOiJIUzI1NiJ9");
      expect(decoded).toBeNull();
    });
  });

  describe("isTokenExpiringSoon", () => {
    it("should return false when token is expired", () => {
      const exp = Math.floor(Date.now() / 1000) - 3600;
      const payload = { sub: "123", exp };
      const base64Payload = Buffer.from(JSON.stringify(payload)).toString(
        "base64",
      );
      const expiredToken = `header.${base64Payload}.signature`;

      const result = jwtDecoder.isTokenExpiringSoon(expiredToken, 60);
      expect(result).toBe(false);
    });

    it("should return false for valid token with long expiry", () => {
      const exp = Math.floor(Date.now() / 1000) + 7200;
      const payload = { sub: "123", exp };
      const base64Payload = Buffer.from(JSON.stringify(payload)).toString(
        "base64",
      );
      const validToken = `header.${base64Payload}.signature`;

      const result = jwtDecoder.isTokenExpiringSoon(validToken, 60);
      expect(result).toBe(false);
    });

    it("should return false for token without exp claim", () => {
      const payload = { sub: "123", name: "Test" };
      const base64Payload = Buffer.from(JSON.stringify(payload)).toString(
        "base64",
      );
      const tokenWithoutExp = `header.${base64Payload}.signature`;

      const result = jwtDecoder.isTokenExpiringSoon(tokenWithoutExp, 60);
      expect(result).toBe(false);
    });
  });
});
