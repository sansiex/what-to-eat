/**
 * 登录云函数
 * 获取用户 openid
 */

exports.main = async (event, context) => {
  // 云函数会自动获取用户的 openid
  const { OPENID } = context

  if (!OPENID) {
    return {
      success: false,
      message: '获取 openid 失败'
    }
  }

  return {
    success: true,
    openid: OPENID
  }
}
