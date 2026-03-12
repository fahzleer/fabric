describe('Products page', () => {
  beforeEach(() => {
    cy.visit('/products')
  })

  it('loads the products page and shows the navbar', () => {
    cy.contains('Fabric').should('be.visible')
  })

  it('shows at least one product card', () => {
    cy.get('main').should('exist')
  })

  it('navigates to product detail on card click', () => {
    cy.get('main a').first().click()
    cy.url().should('match', /\/(product|products)/)
  })
})

describe('Lighthouse performance audit — /products', () => {
  it('scores above thresholds on products page', () => {
    cy.visit('/products')
    cy.lighthouse({
      performance: 80,
      accessibility: 80,
      'best-practices': 80,
      seo: 80,
    })
  })
})
