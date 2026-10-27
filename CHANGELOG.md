# Changelog

## Unreleased

### Breaking
- `contentType` is required by `uploadFile`/`buildFileFormData`.
- `MESSENGER_ALLOWED_MIME_TYPES` is removed (the documented list is not exhaustive).
- `SendP2p*`/`P2pMessenger*` types are renamed `SendP2P*`/`P2PMessenger*`.
- `TemplateState` and `TemplateParameterType` also accept unknown strings, and an unrecognized
  template parameter type is kept in `UserTemplate.parameters` instead of being dropped.
- `GetUserInfoResponse.company_name`, `email` and `phone` are typed `string | null`, as the API allows.
- A non-2xx response without an error envelope now throws `AdsefidApiError` (code `-1`,
  `UNKNOWN_ERROR`; a bare 429 is `AdsefidRateLimitError` with code `2036`, `RATE_LIMITED`), including
  when the body is not JSON. Any 429 is a rate limit.

### Fixed
- Status lookups send ids joined by literal commas, and a GET whose path and query pass 8,000
  characters throws `AdsefidValidationError` instead of reaching the gateway's HTML 414.
- `verifyAndParseWebhook` rejects an empty `Uint8Array` or string secret.
- A malformed success body surfaces as `AdsefidTransportError` instead of a `TypeError`.

### Added
- Every resource method accepts a trailing `{ signal }` (`CallOptions`) to cancel one call.
- Uploads above 15 MiB are rejected locally.
- `timeoutMs` must be a positive finite number.
