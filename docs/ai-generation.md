# Experimental AI response generation

Branch: `feat/llm`. Added October 26, 2026; model discovery and Google Gemini added October 27. This is an opt-in experiment; capture and manual rule creation continue to work without a model or API token.

## Setup and use

Load the production `dist/` build, select a captured response, open the Rule tab, and expand Generate with AI. Select Ollama, LM Studio, OpenAI, Google Gemini, OpenRouter or a custom OpenAI-compatible provider, then choose a model from the dropdown. The extension does not download models.

**Fetch models when changing provider** starts enabled in each editor. Selecting a provider fetches its list after Chrome host access is granted. Cloud presets require a token first: enter it and click **Fetch models**. For custom endpoints, enter the full URL before fetching. Turn off the checkbox to fetch only from the button. **Refresh models** preserves the current selection. **Enter model ID manually** provides a fallback for unavailable, empty or unsupported lists. Merely opening the panel or restoring saved settings does not make a model-list request.

Ollama lists installed models via `GET /api/tags`. Compatible providers use `GET /models` adjacent to the configured `/chat/completions` path: LM Studio/OpenAI typically use `/v1/models`, and OpenRouter uses `/api/v1/models`. Proxy path prefixes and ports are preserved. Custom generation URLs without those recognized suffixes cannot infer a discovery endpoint; use manual entry. Listed models may include entries that do not support chat completions or JSON mode, or require additional account access; choose an appropriate model for generation.

Google Gemini uses `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` for generation and `/v1beta/openai/models` for discovery. Enter a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey), click Fetch models and select a text-generation model. Authentication uses a bearer header; the key is not put into the URL. Gemini's API access, quota and billing belong to your Google API account. This preset uses Google's compatibility API rather than native `generateContent` or Vertex AI authentication.

The endpoint field takes a complete URL, including `/api/chat` for Ollama or `/v1/chat/completions` for compatible APIs. OpenRouter uses `/api/v1/chat/completions`. Cloud presets require a token. Other presets accept an optional bearer token for authenticated local servers or proxies. Changing the provider or endpoint clears the token field to avoid forwarding it to a different destination.

Review and edit the response sample, enter an instruction, accept the data disclosure and choose Generate preview. The button stays visibly disabled until both a nonblank instruction and the agreement checkbox are present; the click handler enforces the same check. It is also disabled while loading or generating. Chrome asks for optional access to the chosen endpoint's host if you have not already granted it for discovery. Host permissions cover paths and ports on that scheme/host for compatibility with supported Chrome versions; generation uses the exact configured URL, and discovery uses its derived model-list URL on the same host. Both refuse redirects. Opening the panel alone does not request host access. Provider selection can request it when automatic model fetching is enabled.

The model returns a proposed name, HTTP status and replacement response body. Use in a new rule opens a separate unsaved draft scoped to the selected request. Review matching fields and response content, then save through the normal rule controls. A model cannot set the URL pattern, overwrite an existing rule ID, or save/enable a rule itself. Saved new rules follow the existing behavior: enabled, with the first matching enabled rule taking priority. Saving is the action that makes the new rule active.

## Data and credentials

The exact response sample displayed in the generator, its original HTTP status, and the user's instruction are sent directly from the extension panel to the selected API. The sample starts from up to the first 32 KiB of the captured body and can be replaced or edited. The automatically included context does not contain captured URLs, query strings, request/response headers, request bodies or GraphQL variables. Sensitive information inside the response body or typed into the instruction is not automatically redacted.

Model discovery is separate from generation consent. Choosing a provider with automatic fetching enabled, or clicking Fetch/Refresh models, sends a metadata-only GET to that server, including the token if supplied/required. It never sends the response sample, prompt, captured URLs, headers or request body. Lists are held only in panel memory and cleared on provider/endpoint/token changes. In-flight queries are cancelled on connection changes, tab deactivation or component cleanup; stale lists cannot replace a newer provider's list. No connection preferences or tokens are persisted by fetching models alone.

Provider, endpoint and model are saved in `chrome.storage.local` when generating. The token is stored separately in `chrome.storage.session`, bound to the exact endpoint. It is not written to persistent storage, synchronized, included in runtime rule commands or exported. Chrome clears session storage on restart and extension reload/update/disable. The panel also holds its current token in memory while open.

Prompts, samples and previews are held in the panel's memory and are not saved by the extension. If a preview becomes a saved rule, its generated name/status/body are persisted and included in rule exports normally. Your provider may retain inputs and outputs or forward them to its upstream model service. No traffic is sent to a Request Recon backend.

Forget saved connection clears stored preferences and the session token. It does not revoke Chrome's host grants or delete provider-side records. Other already-open panels may still hold their current settings in memory; close them to clear those copies. Revoke grants through Chrome's extension site-access controls.

## Limits and failures

- Instructions: 8 KiB. Response sample: 32 KiB, measured as UTF-8 bytes.
- Replacement response body: 1 MiB, consistent with normal rule validation. Entire provider response: at most 2 MiB.
- Timeout: two minutes, including response download. Requests do not stream into the editor.
- Model discovery: 15-second timeout, at most 8 MiB of response data and 5,000 model records. Invalid entries are ignored; invalid schemas and lists without any valid IDs are rejected. An empty list is displayed without disabling manual entry.
- HTTPS for remote endpoints; HTTP only for localhost, IPv4 loopback and IPv6 loopback. URL user information, query strings and fragments are rejected. Private LAN HTTP endpoints are not supported.
- Ollama receives `format: "json"`; Gemini receives `response_format.type: "json_schema"` for the name/status/body envelope; other compatible providers receive `response_format: {"type":"json_object"}`. Choose a model that supports the required format.
- JSON output must contain a nonempty `name`, integer `statusCode` from 200–599 and a string `body`. A simple outer Markdown JSON fence is tolerated. Truncated/refused/non-JSON output is rejected. Statuses 204, 205 and 304 require an empty body.
- Provider errors never display or log raw response messages, which could echo credentials or private data. For HTTP 429, a bounded error-body read extracts only recognized machine codes/types to distinguish quota/billing errors from temporary rate limits. Numeric `Retry-After` values up to 24 hours become a wait-time hint. Unknown or malformed error details retain a generic rate-or-quota explanation. No automatic retry or alternate provider is used.
- Cancel, a selection change, a Rule-tab change or panel cleanup aborts generation. Results are scoped to the request/editor that started the operation, including while a permission prompt is pending.

## Troubleshooting

For Ollama, run its local server and enter an installed model ID (check with `ollama list`). For LM Studio, load a model and start its developer server; confirm the port matches the endpoint field. Keep the sample small enough for that model's context window.

If a local server rejects the extension origin, configure its allowed origins for this extension. In Ollama, set `OLLAMA_ORIGINS` to the specific `chrome-extension://<extension-id>` origin and restart the server, following the [Ollama FAQ](https://docs.ollama.com/faq). Find the extension ID in `chrome://extensions`. Chrome host permission and server-side origin checks are separate; allowing one does not configure the other.

For HTTP 401/403 check token, server authentication, origin policy and account access. For HTTP 400 check the full endpoint, model ID and support for JSON output. For rate limits or exhausted credits, check your provider account. The extension does not relay calls through a backend.

For OpenAI HTTP 429, the status alone does not identify the cause. Codes such as `insufficient_quota`, `credit_balance_exhausted`, `project_spend_limit_exceeded`, `organization_spend_limit_exceeded` or `organization_usage_limit_exceeded` indicate a credit, spending or usage limit. Review the API project's/organization's billing balance and enforced limits; repeating the request will not restore access. `rate_limit_exceeded`, `rate_limit_error` or `slow_down` indicate temporary throttling: wait and reduce request frequency or sample size. A working model-list request does not guarantee generation quota. See the [official OpenAI error-code guide](https://developers.openai.com/api/docs/guides/error-codes).

Recognized quota codes are now shown in the error message; a restriction reported only through `error.type` is labeled as such. Unknown provider strings and raw messages are not displayed. A positive ChatGPT/Codex credit balance does not fund this extension's OpenAI API calls: those use separate API billing. Verify the API balance and limits for the same organization/project as your key. See the [official subscription/API pricing distinction](https://learn.chatgpt.com/docs/pricing?codex-pricing-plans=individual).

## Validation

Automated tests use synthetic responses and cover all presets, request payloads, excluded context, HTTPS/loopback validation, endpoint-scoped token storage, forgotten settings, malformed and oversized responses, cancellation, timeouts, safe output fields, and separate reactive rule drafts. Run `npm test` and `npm run build`.

Model-list tests cover endpoint derivation with proxy prefixes, every preset's GET/auth behavior, metadata-only transmission, normalization/deduplication, empty and invalid lists, byte limits, cancellation and timeout.

Manual checks still required in Chrome with the production build:

1. With AI unused, verify ordinary capture/rule creation and confirm there is no model traffic or host-access prompt.
2. Start Ollama or LM Studio, enter an installed model and generate an empty-list response from synthetic traffic. Confirm the browser host permission prompt and inspect the API payload.
3. Decline host access; confirm no API call occurs. Retry and grant it.
4. Edit the sample to remove a field and confirm only the edited sample, original status and instruction are sent. Captured URL/headers/request body must be absent.
5. Generate a 503 error or a changed GraphQL response. Review the preview, use it in a new rule, and verify no rule is added until Save. Verify an existing matching rule remains unchanged.
6. Cancel during generation. Repeat while switching requests, switching tabs, closing DevTools, and leaving a permission prompt pending. No late preview should apply to a different request.
7. Exercise bad tokens, an offline local server, a model without JSON support, malformed output, response limits and timeout. Existing draft content must survive failures.
8. If desired, test a cloud provider with your own token and synthetic data. This uses your provider account and may incur charges; no live cloud call was made as part of implementation.
9. Reload the extension: provider/model/endpoint should persist; the token should be empty. Verify exports contain only normal rule fields.
10. Verify English/Spanish labels and keyboard navigation at narrow panel widths. Forget the connection and verify the stored connection/token are removed.
11. Change providers with automatic model fetching enabled and disabled. Verify that only the enabled case starts a query, and that declining host access prevents it. For cloud presets, enter a token and fetch explicitly.
12. Refresh a list and confirm the current model remains selected. Change endpoint or token while a request is pending; the previous list must not reappear. Exercise empty lists, offline servers and manual entry, including a saved model not present in the refreshed list.

## API references

- [Ollama Chat API](https://docs.ollama.com/api/chat)
- [Ollama model list](https://docs.ollama.com/api/tags)
- [LM Studio OpenAI-compatible endpoints](https://lmstudio.ai/docs/developer/openai-compat)
- [LM Studio model list](https://lmstudio.ai/docs/developer/openai-compat/models)
- [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)
- [OpenAI model list](https://developers.openai.com/api/reference/resources/models/methods/list)
- [Google Gemini compatibility API, structured output and model listing](https://ai.google.dev/gemini-api/docs/openai)
- [OpenRouter API](https://openrouter.ai/docs/api_reference/overview)
- [OpenRouter model list](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties)
- [Chrome optional permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions)
- [Chrome session storage](https://developer.chrome.com/docs/extensions/reference/api/storage)
