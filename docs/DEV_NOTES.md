# Development Notes

## Codex Browser Smoke Testing

When using the Codex in-app browser for local smoke tests, make sure the Vite server is genuinely running before opening the browser target.

- The sandbox may prevent Vite/esbuild from loading `vite.config.ts`, with an error like `Cannot read directory "../..": Access is denied`. If that happens, start Vite outside the sandbox via an approved escalation.
- This project sets `base: "/stl-hole-filler/"` in `vite.config.ts`, so the local app URL is `http://127.0.0.1:5173/stl-hole-filler/`, not the server root.
- Verify the server first with a simple request to `http://127.0.0.1:5173/stl-hole-filler/`.
- In the Codex browser Playwright shim, use `waitForLoadState({ state: "load" })`. The shim does not support `networkidle`.

