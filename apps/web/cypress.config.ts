import { defineConfig } from 'cypress'
import { lighthouse, prepareAudit } from '@cypress-audit/lighthouse'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    screenshotOnRunFailure: false,
    setupNodeEvents(on) {
      on('before:browser:launch', (_browser, launchOptions) => {
        prepareAudit(launchOptions)
      })
      on('task', {
        lighthouse: lighthouse(),
      })
    },
  },
})
