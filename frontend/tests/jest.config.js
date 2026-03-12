module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/*.test.js'],
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/tests/**'
  ],
  verbose: true
};
