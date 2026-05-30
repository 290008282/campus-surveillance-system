#!/bin/bash

# 生成强随机密钥的脚本
# 用于园区监控系统部署

echo "正在生成安全密钥..."

# 生成 JWT 密钥 (32字节 base64)
JWT_SECRET=$(openssl rand -base64 32)

# 生成 HMAC 密钥 (32字节 base64)
HMAC_KEY=$(openssl rand -base64 32)

# 生成 MySQL root 密码 (16字节 base64)
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 16)

# 生成管理员密码 (12字节 base64)
ADMIN_PASSWORD=$(openssl rand -base64 12)

echo "生成的密钥："
echo "================================"
echo "JWT_SECRET=$JWT_SECRET"
echo "HMAC_KEY=$HMAC_KEY" 
echo "MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD"
echo "ADMIN_PASSWORD=$ADMIN_PASSWORD"
echo "================================"
echo ""
echo "请将这些值复制到 .env 文件中"
echo "请妥善保管这些密钥，不要泄露！"