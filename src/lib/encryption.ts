/**
 * 加密工具
 * 用于加密敏感信息如 Git Token
 */

import crypto from 'crypto';

// 加密算法
const ALGORITHM = 'aes-256-gcm';

// 从环境变量获取加密密钥
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    // 如果没有配置环境变量，使用默认密钥（仅用于开发环境）
    console.warn('警告: 未配置 ENCRYPTION_KEY 环境变量，使用默认密钥');
    return crypto.scryptSync('default-key-for-dev', 'salt', 32);
  }
  
  // 确保密钥长度正确
  return crypto.scryptSync(key, 'salt', 32);
}

/**
 * 加密文本
 */
export async function encrypt(text: string): Promise<string> {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // 返回格式: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * 解密文本
 */
export async function decrypt(encryptedData: string): Promise<string> {
  const key = getEncryptionKey();
  
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('无效的加密数据格式');
  }
  
  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * 验证加密密钥是否有效
 */
export function validateEncryptionKey(): boolean {
  try {
    const key = getEncryptionKey();
    return key.length === 32;
  } catch {
    return false;
  }
}
