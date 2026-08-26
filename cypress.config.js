const { defineConfig } = require("cypress");
const dotenv = require("dotenv");

dotenv.config();

module.exports = defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || "http://localhost:8000",
    specPattern: "cypress/e2e/**/*.cy.js",
    supportFile: "cypress/support/e2e.js",
    fixturesFolder: "cypress/fixtures",
    screenshotsFolder: "cypress/artifacts/screenshots",
    videosFolder: "cypress/artifacts/videos",
    downloadsFolder: "cypress/artifacts/downloads",
    setupNodeEvents(on, config) {
      on("task", {
        log(message) {
          console.log(message);
          return null;
        }
      });

      config.env.adminUser = process.env.CYPRESS_ADMIN_USER || "";
      config.env.adminPassword = process.env.CYPRESS_ADMIN_PASSWORD || "";
      config.env.portalHost = process.env.CYPRESS_PORTAL_HOST || "localhost";

      return config;
    }
  },
  viewportWidth: 1440,
  viewportHeight: 900,
  defaultCommandTimeout: 10000,
  requestTimeout: 15000,
  video: false,
  chromeWebSecurity: false
});
