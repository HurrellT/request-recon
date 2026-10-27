<p align="center">
  <img src="assets/request-recon-logo.png" alt="Request Recon logo" width="160" height="160" />
</p>

<h1 align="center">Request Recon</h1>

<p align="center">Chrome DevTools extension for capturing requests and saving response override rules.</p>

## Screenshots

Inspect captured requests, response headers, and JSON bodies directly in Chrome DevTools.

![Request Recon DevTools panel showing captured requests, response headers, and a JSON response body](assets/screenshots/1.png)

<details>
<summary>REST response override workflow</summary>

Create a rule from a captured request and edit its replacement response body.

![Response rule editor with URL matching, HTTP method, status code, and an edited JSON body](assets/screenshots/2.png)

Save and manage rules in the sidebar. Repeat the request to apply a newly saved rule.

![Saved rule in the sidebar with a reminder to repeat the request before the override can apply](assets/screenshots/3.png)

See the overridden response in the page and the intercepted request in the panel.

![REST response override applied, with the modified JSON displayed in the browser](assets/screenshots/4.png)

</details>

<details>
<summary>GraphQL response overrides</summary>

Match a GraphQL request by operation name and customize its response.

![GraphQL response rule matching the GetUser operation and showing its JSON response body](assets/screenshots/5.png)

Repeat the operation to see the modified result and the override notification.

![GraphQL GetUser response overridden with a modified user ID and an on-page confirmation](assets/screenshots/6.png)

</details>

## Development

Requires Node.js 22.12+ and Chrome 118+.

```bash
npm ci
npm run dev
```

## Production build

```bash
npm run build
```

In `chrome://extensions`, enable Developer mode and use **Load unpacked** to select the generated `dist/` directory. Selecting the repository root loads unbuilt JSX and leaves the DevTools panel blank. After a rebuild, reload the extension and reopen DevTools.

## Traffic filters

The DevTools panel hides CORS preflights, static resources, and framework navigation payloads by default. Open **Traffic / Tráfico** to show any category or choose **Show all / Mostrar todo**. The visible/total count in the request list reflects URL and method search before traffic is hidden.

The filters only change the list: requests remain captured and response override rules still run. Failed requests and requests matched by an active rule stay visible. Visibility choices are saved in Chrome's local extension storage.

## Capture and response overrides

Capture runs while the DevTools panel is connected. Closing it stops capture and detaches the debugger after a two-second reconnect grace period. The popup also lets you stop all current capture sessions. Rules are shared across captured tabs; their URL match determines where they apply, including after navigation.

Response headers/status and network failures are captured without waiting for response bodies. Text bodies are collected after loading completes, up to 256 KiB per response. Binary data, event streams, and larger responses retain their metadata but omit body previews. The panel retains at most 1,000 requests and approximately 32 MiB of request data. Capture is best-effort when Chrome evicts a body or the pending-request budget is exceeded.

Request-body previews and body-filter matching use the first 64 KiB. GraphQL operation matching requires a complete JSON body within that limit. URLs longer than 16 KiB are not matched.

Rules apply at the response stage. An explicit replacement body is sent immediately, so the original upstream body is unavailable for that request. Uncheck **Replace response body** to preserve the original bytes when changing only status or headers. JSON response bodies are formatted when opening a rule or restoring a captured response. Further edits are saved as entered; use **Format JSON** to format them again. Press **Cmd+S / Ctrl+S** while the Rule tab is active to save or update the rule.

**Simulate response error** changes the client-visible result. The outbound request has already reached the server and can cause side effects; this feature does not prevent a POST or GraphQL mutation from running.

## Rules and imports

New request-derived URL patterns are anchored to the origin and exact path, while permitting different query parameters. Patterns use [RE2 syntax](https://github.com/google/re2/wiki/Syntax); backreferences and lookahead are unsupported. Unsupported or malformed saved rules are ignored with a warning, so they cannot block traffic. Legacy exact-URL rules remain supported.

Imports accept a legacy rule object/array or the versioned export format. Incoming rules are validated and start **disabled**. Enable them deliberately after reviewing their URL scope and replacement response. Import preserves file order and creates a new ID on a collision, retaining the existing rule. The first enabled matching rule in list order takes precedence.

Limits are 500 rules, 1 MiB per replacement body, and 8 MiB per import/export. Invalid status codes, headers, field types, patterns, and duplicate IDs in one file are rejected. All rule mutations are serialized by the service worker; success messages appear only after storage succeeds.

Rules, response fixtures, and request-body filters are saved locally in extension storage. Exports include these values verbatim and can contain personal data or credentials; review files before sharing. Inspected-page notifications show a generic label rather than rule names or URLs. Capture does not upload traffic to the developer. The optional AI feature sends only the response sample and instructions you approve to your chosen endpoint, as described below.

## AI-assisted mock responses (experimental)

The `feat/llm` branch adds an optional generator in the **Rule** tab for a selected response. Use it to generate fictional data, empty states, edge cases, or error responses from a captured sample. The generator proposes a rule name, HTTP status and replacement body; URL, method and GraphQL matching are derived locally from the selected request.

1. Select a captured request, open **Rule**, and expand **Generate with AI**.
2. Choose a provider and select a model from the dropdown. **Fetch models when changing provider** is enabled by default; turn it off to load lists manually. Start your local model server first if using Ollama or LM Studio. For cloud providers, enter your own API token and click **Fetch models**. Use **Refresh models** to reload the list, or choose **Enter model ID manually** if discovery is unavailable. Cloud generation may incur charges.
3. Review the full API endpoint and edit the response sample to remove any information you do not want to send. Enter an instruction, such as “Generate 10 fictional users with the same structure” or “Return an empty list” or “Return a JSON error with status 503”.
4. Enter a nonblank instruction and check the agreement checkbox to enable **Generate preview**, then grant Chrome access to that endpoint's host when prompted.
5. Review the generated result, click **Use in a new rule**, then review and **Save rule**. The existing matching rule is not overwritten. Generation and preview alone do not save or activate any rule.

| Provider | Default endpoint | Token |
| --- | --- | --- |
| Ollama | `http://localhost:11434/api/chat` | Optional |
| LM Studio | `http://localhost:1234/v1/chat/completions` | Optional, depending on server authentication |
| OpenAI | `https://api.openai.com/v1/chat/completions` | Required |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` | Gemini API key from Google AI Studio |
| OpenRouter | `https://openrouter.ai/api/v1/chat/completions` | Required |
| OpenAI-compatible (custom) | Enter the full chat completions URL | Depends on your server |

Use a model that supports JSON output. The Google Gemini preset uses Google's OpenAI-compatible API, including its model-list endpoint and a structured JSON response schema. Get its API key from [Google AI Studio](https://aistudio.google.com/apikey), then click Fetch models and select a text-generation model. Native Anthropic Messages and Gemini `generateContent` APIs are not used. Remote endpoints require HTTPS; HTTP is accepted only for loopback hosts such as `localhost` and `127.0.0.1`. For a model on another computer, use an HTTPS endpoint. Custom paths and ports are supported.

The generator sends your instruction (up to 8 KiB), the editable response sample (up to 32 KiB), and its original HTTP status. It excludes the captured URL, request/response headers, request body and GraphQL variables. The sample and your instruction can still contain sensitive data: review them before sending. Generation requires your explicit confirmation. Model discovery makes a separate metadata-only request to the chosen server, with your token when required; it sends no response sample or instruction. Chrome may request host access for discovery or generation. Your chosen provider's retention and billing terms apply, including any upstream provider used by an API gateway.

Ollama model discovery uses `/api/tags`; compatible providers use the adjacent `/models` endpoint. Refreshing preserves the selected model. Lists do not guarantee chat/JSON compatibility or account access to every entry. Model lists stay in panel memory, are cleared when the connection/token changes, and time out after 15 seconds. Opening the panel alone does not fetch models.

Connection preferences are saved locally when generating. The API token is scoped to the exact endpoint and kept in Chrome's in-memory session storage; it is cleared on browser restart or extension reload. Tokens, prompts and samples are not included in rule exports. Generated content is included if you save and export the resulting rule. **Forget saved connection** clears stored connection preferences and the session token; previously granted host access can be revoked in Chrome's extension site-access settings.

Generation can be cancelled and stops after two minutes. Changing the selected request, leaving the Rule tab, or closing the panel cancels the pending generation and discards its preview. Invalid, incomplete or oversized output is rejected. See [AI setup, privacy details, troubleshooting and manual checks](docs/ai-generation.md).

HTTP 429 messages distinguish recognized quota/spend-limit errors from temporary rate limits and show the recognized quota code. Check the API account's billing and limits for quota errors; retrying does not restore credits. **ChatGPT/Codex subscription credits do not cover OpenAI API calls**; API usage has separate billing. Gemini uses its own Google API key, quotas and billing. If the provider gives no recognized error code, the extension explains both possible causes rather than assuming an invalid key.

## Verification

```bash
npm test
npm run build
npm audit
```

Tests exercise debugger lifecycle failures, paused-request recovery, streaming and body-size policies, binary preservation, concurrent mutations, import validation/order, command acknowledgements, matching, and UI helpers. CI runs tests, the production build, and the dependency audit.

AI tests use synthetic provider responses to verify protocol payloads, data minimization, endpoint/token handling, size limits, cancellation, timeouts and separate rule drafts. The test command uses Solid's browser export conditions to exercise reactive editor state. These tests make no paid API calls; live provider and Chrome permission checks remain manual.

## Languages

The panel and extension popup support English and Spanish. They start in the browser's language (English for other browser languages). Use the **EN / ES** selector in the panel or the language selector in the popup to change it. The choice is saved in Chrome's local extension storage and shared between both views.

## License

Request Recon source code is licensed under the Mozilla Public License 2.0; see [LICENSE](LICENSE). Third-party assets and libraries retain their own licenses. Tabler Icons and bundled library notices are in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt). Both notice files are included in the built extension.
