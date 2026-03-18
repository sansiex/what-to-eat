/**
 * 登录云函数
 * 获取用户 openid
 */

const cloud = require('wx-server-sdk')

exports.main = async (event, context) => {
  // 使用 wx-server-sdk 获取微信上下文
  const wxContext = cloud.getWXContext()
  const OPENID = wxContext.OPENID
  
  console.log('Login wxContext:', { OPENID: OPENID ? '存在' : '不存在' })
  console.log('Event data:', JSON.stringify(event.data || {}))

  // 安全检查：防止使用旧的固定模拟 openid（这些是被污染的测试数据）
  if (OPENID === 'mock_openid_local_dev' || OPENID === 'test_openid') {
    console.error('警告：检测到被污染的测试 openid，拒绝使用')
    return {
      success: false,
      message: '检测到被污染的测试 openid，请清除小程序缓存后重试'
    }
  }

  // 如果有真实的 OPENID，直接使用
  if (OPENID) {
    console.log('使用微信真实 OPENID:', OPENID.substring(0, 10) + '...')
    return {
      success: true,
      openid: OPENID
    }
  }

  // 本地开发环境没有 OPENID，使用固定的模拟值
  console.log('本地开发环境，使用固定模拟 openid')
  const devOpenid = 'dev_local_sansi_fixed_id'
  console.log('Using dev openid:', devOpenid)
  console.log('警告：如果这是真机调试，说明 OPENID 获取失败，请检查云函数配置')
  return {
    success: true,
    openid: devOpenid,
    warning: '本地开发环境模拟 openid'
  }
}
