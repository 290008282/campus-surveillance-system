#!/bin/bash

# 服务器Docker权限修复脚本
# 在服务器本地运行

echo "=========================================="
echo "Docker权限修复脚本"
echo "=========================================="

# 检查当前用户
CURRENT_USER=$(whoami)
echo "当前用户: $CURRENT_USER"

# 添加当前用户到docker组
echo "添加用户到docker组..."
sudo usermod -aG docker $CURRENT_USER

# 设置sudo免密码
echo "配置sudo免密码..."
echo "$CURRENT_USER ALL=(ALL) NOPASSWD:ALL" | sudo tee -a /etc/sudoers

# 修复docker.sock权限
echo "修复docker.sock权限..."
sudo chmod 666 /var/run/docker.sock

# 测试Docker权限
echo "测试Docker权限..."
sudo docker ps

echo "=========================================="
echo "权限修复完成！"
echo "=========================================="
echo "请退出当前SSH会话并重新登录以使权限生效"
echo "然后运行: bash auto-fix-deploy.sh"
echo "=========================================="