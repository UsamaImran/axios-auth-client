# axios-auth-client

A lightweight, **framework-agnostic** Axios wrapper with automatic JWT access token refresh (proactive + reactive), 401 retry logic, and custom refresh support — written in TypeScript.

## Features

- **Proactive token refresh** — Detects when the JWT is about to expire (configurable threshold) and refreshes it _before_ the request is sent
- **Reactive 401 handling** — Automatically retries failed requests after refreshing the token on a `401 Unauthorized` response
- **Queue / subscriber pattern** — Concurrent requests during a token refresh are queued and replayed once the new token is available — no duplicate refresh calls
- **Custom refresh function** — Bring your own refresh logic via `customRefreshFn` for non-standard auth flows
- **Flexible token response path** — Extract the new access token from any nested field in the refresh endpoint response using dot-notation (e.g. `"data.token"`)
- **Configurable token header** — Use `Authorization`, `x-access-token`, or any custom header
- **Public client mode** — Skip auth entirely for unauthenticated routes via `isPublic: true`
- **Full TypeScript support** — Ships with `.d.ts` declarations; all Axios types are re-exported
- **Zero runtime dependencies** — `axios` is a peer dependency; the package itself has no extra runtime deps
- **Universal environment support** — Works in browsers (uses `atob`) and Node.js (manual base64 fallback) without any polyfills

---

## Installation

```bash
npm install axios-auth-client axios
# or
yarn add axios-auth-client axios
```

> **Peer dependency:** `axios ^1.6.0` is required.

---

## Quick Start

```ts
import { ApiClient } from 'axios-auth-client';

const client = new ApiClient(
  // Axios config (baseURL, timeout, etc.)
  { baseURL: 'https://api.example.com' },

  // Auth config
  {
    getAccessToken:  () => localStorage.getItem('accessToken'),
    getRefreshToken: () => localStorage.getItem('refreshToken'),
    setAccessToken:  (token) => localStorage.setItem('accessToken', token),
    removeTokens:    () => {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    },
    refreshTokenEndpoint: '/auth/refresh',
    onAuthFailure: () => {
      // e.g. redirect to login
      window.location.href = '/login';
    },
  }
);

// Use like a normal HTTP client
const user = await client.get<User>('/users/me');
const created = await client.post<Post>('/posts', { title: 'Hello' });
```

---

## API Reference

### `new ApiClient(axiosConfig, authConfig, options?)`

| Parameter    | Type                    | Description                                                |
|--------------|-------------------------|------------------------------------------------------------|
| `axiosConfig`| `CreateAxiosDefaults`   | Standard Axios instance configuration (`baseURL`, headers, etc.) |
| `authConfig` | `AuthConfig`            | Token management callbacks and refresh settings            |
| `options`    | `ApiClientOptions`      | Optional — pass `{ isPublic: true }` to skip auth entirely |

---

### `AuthConfig`

| Property                  | Type                                              | Required | Default          | Description |
|---------------------------|---------------------------------------------------|----------|------------------|-------------|
| `getAccessToken`          | `() => string \| null`                           | ✅       | —                | Returns the current access token |
| `getRefreshToken`         | `() => string \| null`                           | ✅       | —                | Returns the current refresh token |
| `setAccessToken`          | `(token: string) => void`                        | ✅       | —                | Persists the new access token |
| `removeTokens`            | `() => void`                                     | ✅       | —                | Clears both tokens (called on auth failure) |
| `refreshTokenEndpoint`    | `string`                                          | ✅       | —                | Endpoint path for token refresh (e.g. `"/auth/refresh"`) |
| `onAuthFailure`           | `() => void`                                     | ❌       | `undefined`      | Called after refresh fails — use to redirect to login |
| `tokenHeader`             | `string`                                          | ❌       | `"Authorization"`| HTTP header used to send the access token |
| `expiryThresholdSeconds`  | `number`                                          | ❌       | `60`             | Seconds before JWT expiry to trigger a proactive refresh |
| `customRefreshFn`         | `(instance: AxiosInstance) => Promise<string>`   | ❌       | `undefined`      | Override the default refresh logic with your own |
| `sendRefreshTokenInBody`  | `boolean`                                         | ❌       | `false`          | Send the refresh token in the request body instead of the header |
| `tokenResponsePath`       | `string`                                          | ❌       | `"accessToken"`  | Dot-notation path to the access token in the refresh response (e.g. `"data.token"`) |

---

### HTTP Methods

All methods are generic and return `Promise<T>` (unwrapped `response.data`).

```ts
client.get<T>(url, params?, config?)
client.post<T, D>(url, data?, params?, config?)
client.put<T, D>(url, data?, params?, config?)
client.patch<T, D>(url, data?, params?, config?)
client.delete<T>(url, params?, config?)
```

### Utility Methods

```ts
// Update default headers on the underlying Axios instance
client.updateDefaultHeaders({ 'x-tenant-id': 'abc123' });

// Access the raw Axios instance for advanced use cases
const axiosInstance = client.getAxiosInstance();
```

---

## Advanced Usage

### Custom Refresh Function

If your API has a non-standard token refresh flow, pass a `customRefreshFn`:

```ts
const client = new ApiClient(
  { baseURL: 'https://api.example.com' },
  {
    // ...required callbacks...
    refreshTokenEndpoint: '/auth/refresh', // still required to avoid interceptor loops
    customRefreshFn: async (axiosInstance) => {
      const res = await axiosInstance.post('/auth/custom-refresh', {
        token: mySpecialToken,
      });
      return res.data.jwt; // return the new access token string
    },
  }
);
```

### Nested Token Response Path

If your refresh endpoint returns the token at a nested path:

```json
{ "data": { "tokens": { "access": "eyJ..." } } }
```

Set `tokenResponsePath` accordingly:

```ts
tokenResponsePath: 'data.tokens.access'
```

### Public Client (No Auth)

For routes that don't need authentication:

```ts
const publicClient = new ApiClient(
  { baseURL: 'https://api.example.com' },
  authConfig,
  { isPublic: true }
);

const posts = await publicClient.get('/public/posts');
```

### Refresh Token Sent in Body

Some APIs expect the refresh token in the POST body:

```ts
sendRefreshTokenInBody: true
// POSTs: { refreshToken: "<token>" }
```

---

## How It Works

### Proactive Refresh (Pre-request)

On every outgoing request, the request interceptor decodes the JWT payload and checks the `exp` claim. If the token expires within `expiryThresholdSeconds` (default: 60s), a refresh is triggered _before_ the request is dispatched. This prevents unnecessary 401s.

### Reactive Refresh (Post-401)

If the server responds with a `401 Unauthorized`, the response interceptor catches it (once per request, via an `_retry` flag), refreshes the token, and replays the original request with the new token.

### Concurrent Request Queuing

If multiple requests fire simultaneously while a refresh is already in-progress, they are queued via a subscriber/promise pattern. All queued requests resume automatically once the single refresh resolves — ensuring only **one** refresh call is ever made at a time.

```
Request A ──► isRefreshing=true ──► refresh call ──► newToken ──► retry A
Request B ──► queued ────────────────────────────────────────► retry B
Request C ──► queued ────────────────────────────────────────► retry C
```

---

## Project Structure

```
axios-auth-client/
├── src/
│   ├── apiClient.ts   # Core ApiClient class with interceptor logic
│   ├── types.ts       # AuthConfig, ApiClientOptions, RefreshSubscriber types
│   └── index.ts       # Public exports (class + types)
├── tsconfig.json
├── tsconfig.build.json
└── package.json
```

---

## Build & Development

```bash
# Build (compiles to dist/)
npm run build

# Watch mode
npm run build:watch

# Type check only
npm run type-check

# Lint
npm run lint
npm run lint:fix

# Format
npm run format

# Tests
npm test
npm run test:watch
npm run test:coverage
```

> Running `npm publish` automatically executes tests, lint, and build via `prepublishOnly`.

---

## TypeScript

Full type definitions are included. Commonly used Axios types are re-exported for convenience:

```ts
import type {
  AuthConfig,
  ApiClientOptions,
  QueryParams,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios-auth-client';
```

---

## Requirements

- Node.js `>= 16`
- TypeScript `>= 5.x` (for consumers using TypeScript)
- `axios ^1.6.0` (peer dependency)

---

## License

[MIT](./LICENSE) © [Usama Imran](https://github.com/UsamaImran)
