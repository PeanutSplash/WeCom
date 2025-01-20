import crypto from 'crypto'

export const decryptMessage = (message: string, encodingAESKey: string): string => {
  try {
    const aesKey = Buffer.from(encodingAESKey + '=', 'base64')
    const iv = aesKey.slice(0, 16)
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv)
    decipher.setAutoPadding(false)

    const decrypted = Buffer.concat([Buffer.from(decipher.update(message, 'base64')), Buffer.from(decipher.final())])

    return parseDecryptedMessage(decrypted)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    logger.error('解密消息失败:', errorMessage)
    throw new Error(`消息解密失败: ${errorMessage}`)
  }
}

const parseDecryptedMessage = (decrypted: Buffer): string => {
  const padLen = decrypted[decrypted.length - 1]
  if (padLen < 1 || padLen > 32) {
    throw new Error('无效的填充长度')
  }

  const unpaddedData = decrypted.slice(0, decrypted.length - padLen)
  const msgLen = unpaddedData.readUInt32BE(16)
  return unpaddedData.slice(20, 20 + msgLen).toString('utf8')
}
