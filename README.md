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

The DevTools panel hides CORS preflights, static resources, and framework navigation payloads by default. Open **Tráfico** to show any category or choose **Mostrar todo**. The visible/total count in the request list reflects URL and method search before traffic is hidden.

The filters only change the list: requests remain captured and response override rules still run. Failed requests and requests matched by an active rule stay visible. Visibility choices are saved in Chrome's local extension storage.
