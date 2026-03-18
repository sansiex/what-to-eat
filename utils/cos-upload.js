/**
 * 菜品图片上传工具
 * 基于微信云存储（底层 COS）上传并返回 fileID
 */

function buildCloudPath(openid = 'anonymous', ext = 'jpg') {
  const timestamp = Date.now()
  const rand = Math.floor(Math.random() * 1000000)
  const safeExt = (ext || 'jpg').toLowerCase()
  return `dish-images/${openid}/${timestamp}_${rand}.${safeExt}`
}

function getExtFromPath(path = '') {
  const match = path.match(/\.([a-zA-Z0-9]+)$/)
  return match ? match[1] : 'jpg'
}

function uploadDishImage(tempFilePath) {
  return new Promise((resolve, reject) => {
    if (!tempFilePath) {
      reject(new Error('图片路径不能为空'))
      return
    }

    const openid = wx.getStorageSync('openid') || 'anonymous'
    const ext = getExtFromPath(tempFilePath)
    const cloudPath = buildCloudPath(openid, ext)

    wx.cloud.uploadFile({
      cloudPath,
      filePath: tempFilePath,
      success: (res) => {
        if (!res.fileID) {
          reject(new Error('上传成功但未返回 fileID'))
          return
        }
        resolve({ fileID: res.fileID, cloudPath })
      },
      fail: reject
    })
  })
}

module.exports = {
  uploadDishImage
}
