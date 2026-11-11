const { defineConfig } = require("@playwright/test");

// BASE_URL permite apuntar las pruebas a otro servidor sin tocar los specs
// (en la máquina de Memo el 8080 lo ocupa Docker: BASE_URL=http://127.0.0.1:8089).
const BASE_URL = process.env.BASE_URL || (process.env.CI ? "http://127.0.0.1:8080" : "http://localhost:8080");
const PUERTO = new URL(BASE_URL).port || "80";

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: BASE_URL,
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  // En CI Playwright levanta el sitio estático; en local se usa el servidor que ya esté corriendo.
  webServer: process.env.CI
    ? {
        command: `npx --yes http-server . -p ${PUERTO} -a 127.0.0.1 -s -c-1`,
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 60000,
      }
    : undefined,
});
