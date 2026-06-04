export class JwtDecoder {
  decode(token: string): Record<string, any> | null {
    try {
      const base64Url = token.split(".")[1];
      if (!base64Url) return null;

      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonString = this.decodeBase64(base64);
      return JSON.parse(jsonString);
    } catch (error) {
      console.error("Failed to decode JWT:", error);
      return null;
    }
  }

  private decodeBase64(base64: string): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let output = "";
    let i = 0;

    while (i < base64.length) {
      const a = chars.indexOf(base64.charAt(i++));
      const b = chars.indexOf(base64.charAt(i++));
      const c = chars.indexOf(base64.charAt(i++));
      const d = chars.indexOf(base64.charAt(i++));

      const bits = (a << 18) | (b << 12) | ((c & 63) << 6) | (d & 63);
      const byte1 = (bits >> 16) & 0xff;
      const byte2 = (bits >> 8) & 0xff;
      const byte3 = bits & 0xff;

      output += String.fromCharCode(byte1);
      if (c !== 64) output += String.fromCharCode(byte2);
      if (d !== 64) output += String.fromCharCode(byte3);
    }

    return output;
  }

  isTokenExpiringSoon(token: string, thresholdSeconds: number): boolean {
    const payload = this.decode(token);
    if (!payload) return false;

    const exp = payload.exp as number | undefined;
    if (!exp) return false;

    const currentTime = Math.floor(Date.now() / 1000);
    return exp - currentTime < thresholdSeconds && exp > currentTime;
  }
}
