# Request Recon

Chrome DevTools extension for capturing requests and saving response override rules.

## Development

```bash
npm install
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

## Languages

The panel and extension popup support English and Spanish. They start in the browser's language (English for other browser languages). Use the **EN / ES** selector in the panel or the language selector in the popup to change it. The choice is saved in Chrome's local extension storage and shared between both views.

## License

Request Recon source code is licensed under the Mozilla Public License 2.0; see [LICENSE](LICENSE). Third-party assets and libraries retain their own licenses. Tabler Icons and bundled library notices are in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt). Both notice files are included in the built extension.
