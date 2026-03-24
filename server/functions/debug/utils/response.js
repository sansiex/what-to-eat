/**
 * 响应工具函数（与其它云函数一致）
 */

function success(data = null, message = '操作成功') {
  return {
    code: 0,
    message,
    data,
    success: true
  };
}

function error(message = '操作失败', code = -1, data = null) {
  return {
    code,
    message,
    data,
    success: false
  };
}

function paramError(message = '参数错误') {
  return error(message, 400);
}

function unauthorized(message = '未授权') {
  return error(message, 401);
}

function serverError(message = '服务器内部错误') {
  return error(message, 500);
}

module.exports = {
  success,
  error,
  paramError,
  unauthorized,
  serverError
};
