import { JwtDecoder } from "../../jwt/jwtDecoder";

describe("JWT Base64URL decoding", () => {
  const decoder = new JwtDecoder();

  it("should decode ASCII payloads", () => {
    const payload = Buffer.from(JSON.stringify({ message: "Hello World" })).toString("base64url");
    expect(decoder.decode(`header.${payload}.signature`)).toEqual({
      message: "Hello World",
    });
  });

  it("should decode unpadded Base64URL payloads", () => {
    const payload = Buffer.from(JSON.stringify({ value: "ABC" })).toString("base64url");
    expect(decoder.decode(`header.${payload}.signature`)).toEqual({ value: "ABC" });
  });
});
