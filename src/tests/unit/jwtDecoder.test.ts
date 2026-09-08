import { JwtDecoder } from "../../jwt/jwtDecoder";

describe("JwtDecoder", () => {
  let jwtDecoder: JwtDecoder;

  const tokenFromPayload = (payload: Record<string, unknown>) => {
    const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
    return `header.${base64Payload}.signature`;
  };

  beforeEach(() => {
    jwtDecoder = new JwtDecoder();
  });

  describe("decode", () => {
    it("should decode valid JWT payloads", () => {
      const token = tokenFromPayload({
        sub: "1234567890",
        name: "John Doe",
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      expect(jwtDecoder.decode(token)).toMatchObject({
        sub: "1234567890",
        name: "John Doe",
      });
    });

    it("should decode UTF-8 payloads", () => {
      const token = tokenFromPayload({ name: "José 🚀" });
      expect(jwtDecoder.decode(token)).toEqual({ name: "José 🚀" });
    });

    it("should return null for malformed tokens", () => {
      expect(jwtDecoder.decode("invalid.token")).toBeNull();
      expect(jwtDecoder.decode("only-one-part")).toBeNull();
    });
  });

  describe("isTokenExpiringSoon", () => {
    it("should return true when token is expired", () => {
      const token = tokenFromPayload({ exp: Math.floor(Date.now() / 1000) - 3600 });
      expect(jwtDecoder.isTokenExpiringSoon(token, 60)).toBe(true);
    });

    it("should return true when token expires within the threshold", () => {
      const token = tokenFromPayload({ exp: Math.floor(Date.now() / 1000) + 30 });
      expect(jwtDecoder.isTokenExpiringSoon(token, 60)).toBe(true);
    });

    it("should return false for a token with long expiry", () => {
      const token = tokenFromPayload({ exp: Math.floor(Date.now() / 1000) + 7200 });
      expect(jwtDecoder.isTokenExpiringSoon(token, 60)).toBe(false);
    });

    it("should return false for invalid exp claims", () => {
      expect(jwtDecoder.isTokenExpiringSoon(tokenFromPayload({ exp: "soon" }), 60)).toBe(false);
      expect(jwtDecoder.isTokenExpiringSoon(tokenFromPayload({}), 60)).toBe(false);
    });
  });
});
