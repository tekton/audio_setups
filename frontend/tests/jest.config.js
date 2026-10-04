module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/*.test.js', '**/*.test.mjs'], // .mjs tests import the app's ES modules natively
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/tests/**'
  ],
  verbose: true
};
