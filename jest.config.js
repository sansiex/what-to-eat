/**
 * Jest 配置文件
 * 配置 miniprogram-simulate 测试环境
 */

const path = require('path');

module.exports = {
  testEnvironment: 'jsdom',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'pages/**/*.js',
    'utils/**/*.js'
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  moduleNameMapper: {
    '^../../app.js$': '<rootDir>/tests/__mocks__/app.js',
    '^../../utils/cloud-api.js$': '<rootDir>/tests/__mocks__/cloud-api.js'
  },
  verbose: true,
  // miniprogram-simulate 配置
  transform: {},
  transformIgnorePatterns: [
    'node_modules/(?!miniprogram-simulate)'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000
};
