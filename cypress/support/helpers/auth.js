function adminCredentials() {
  return {
    user: Cypress.env("adminUser"),
    password: Cypress.env("adminPassword")
  };
}

module.exports = {
  adminCredentials
};
