/**
 * Mock Cloud API
 */
module.exports = {
  API: {
    dish: {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      get: jest.fn()
    },
    menu: {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      get: jest.fn()
    },
    meal: {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      get: jest.fn(),
      close: jest.fn(),
      reopen: jest.fn(),
      generateShareLink: jest.fn()
    },
    order: {
      create: jest.fn(),
      cancel: jest.fn(),
      listByMeal: jest.fn(),
      listByUser: jest.fn(),
      getMyOrder: jest.fn(),
      createAnonymous: jest.fn()
    },
    user: {
      login: jest.fn(),
      get: jest.fn(),
      update: jest.fn()
    },
    kitchen: {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      setDefault: jest.fn()
    },
    share: {
      generateShareLink: jest.fn()
    },
    anonymousOrder: {
      create: jest.fn()
    }
  }
};
