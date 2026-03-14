/**
 * Mock App
 */
module.exports = {
  getApp: () => ({
    globalData: {
      currentMeal: null,
      editingMeal: null,
      viewMode: false
    }
  })
};
