/**
 * 响应工具函数
 * 统一处理云函数返回格式
 */

/**
 * 成功响应
 * @param {Object} data - 响应数据
 * @param {string} message - 响应消息
 * @returns {Object} 标准成功响应
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
 * @param {Object} data - 附加数据
 * @returns {Object} 标准错误响应
 */
function error(message = '操作失败', code = -1, data = null) {
  return {
    code,
    message,
    data,
    success: false
  };
}

/**
 * 参数错误响应
 * @param {string} message - 错误消息
 * @returns {Object} 参数错误响应
 */
function paramError(message = '参数错误') {
  return error(message, 400);
}

/**
 * 未授权响应
 * @param {string} message - 错误消息
 * @returns {Object} 未授权响应
 */
function unauthorized(message = '未授权') {
  return error(message, 401);
}

/**
 * 未找到响应
 * @param {string} message - 错误消息
 * @returns {Object} 未找到响应
 */
function notFound(message = '资源不存在') {
  return error(message, 404);
}

/**
 * 服务器错误响应
 * @param {string} message - 错误消息
 * @returns {Object} 服务器错误响应
 */
function serverError(message = '服务器内部错误') {
  return error(message, 500);
}

module.exports = {
  success,
  error,
  paramError,
  unauthorized,
  notFound,
  serverError
};
