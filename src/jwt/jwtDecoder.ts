export interface JwtPayload {
  exp?: number;
  [key: string]: unknown;
}

export class JwtDecoder {
  decode(token: string): JwtPayload | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3 || !parts[1]) return null;

      return JSON.parse(this.decodeBase64Url(parts[1])) as JwtPayload;
    } catch {
      return null;
    }
  }

  private decodeBase64Url(input: string): string {
    const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

    if (typeof globalThis.atob !== "function") {
      throw new Error("Base64 decoding is not supported in this environment");
    }

    const binary = globalThis.atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  isTokenExpiringSoon(token: string, thresholdSeconds: number): boolean {
    const payload = this.decode(token);
    const exp = payload?.exp;

    if (typeof exp !== "number" || !Number.isFinite(exp)) return false;

    const currentTime = Math.floor(Date.now() / 1000);
    return exp <= currentTime + Math.max(0, thresholdSeconds);
  }
}
