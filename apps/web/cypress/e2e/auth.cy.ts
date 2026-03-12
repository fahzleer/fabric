describe('Auth pages', () => {
  it('shows the login page', () => {
    cy.visit('/auth/login')
    cy.get('form').should('exist')
  })

  it('shows validation error on empty submit', () => {
    cy.visit('/auth/login')
    cy.get('button[type="submit"]').click()
    cy.url().should('include', '/auth/login')
  })

  it('shows "Continue with Facebook" button', () => {
    cy.visit('/auth/login')
    cy.get('[data-testid="facebook-login-btn"]').should('exist')
    cy.get('[data-testid="facebook-login-btn"]').should('contain.text', 'Facebook')
  })
})

describe('Lighthouse performance audit — /auth/login', () => {
  it('login page scores above thresholds', () => {
    cy.visit('/auth/login')
    cy.lighthouse({
      performance: 80,
      accessibility: 80,
      'best-practices': 80,
      seo: 80,
    })
  })
})
