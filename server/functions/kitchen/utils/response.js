/**
 * 响应工具类
 * 提供统一的响应格式
 */

/**
 * 成功响应
 * @param {*} data - 响应数据
 * @param {string} message - 响应消息
 * @returns {Object} 响应对象
 */
function success(data = null, message = '操作成功') {
  return {
    code: 0,
    message,
    data,
    success: true
  };
}

/**
 * 错误响应
 * @param {string} message - 错误消息
 * @param {number} code - 错误码
 * @returns {Object} 响应对象
 */
function error(message = '操作失败', code = -1) {
  return {
    code,
    message,
    data: null,
    success: false
  };
}

/**
 * 参数错误响应
 * @param {string} message - 错误消息
 * @returns {Object} 响应对象
 */
function paramError(message = '参数错误') {
  return error(message, 400);
}

/**
 * 未找到响应
 * @param {string} message - 错误消息
 * @returns {Object} 响应对象
 */
function notFound(message = '资源不存在') {
  return error(message, 404);
}

module.exports = {
  success,
  error,
  paramError,
  notFound
};
