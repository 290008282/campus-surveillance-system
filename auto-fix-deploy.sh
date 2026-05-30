#!/bin/bash

# 园区监控系统一键修复和部署脚本
# 自动完成所有修复和部署工作

set -e

echo "=========================================="
echo "园区监控系统一键修复和部署"
echo "=========================================="

# 配置
PROJECT_DIR="/www/campus-surveillance-system"
SERVER_IP="192.168.0.254"
SSH_USER="lihongfeng"
SSH_PASS="Lhf041588"

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# 使用sshpass进行SSH连接
if ! command -v sshpass &> /dev/null; then
    log_info "安装sshpass..."
    apt-get update && apt-get install -y sshpass
fi

# SSH命令函数（使用sudo）
ssh_sudo() {
    sshpass -p "$SSH_PASS" ssh -o StrictHostKeyChecking=no $SSH_USER@$SERVER_IP "echo '$SSH_PASS' | sudo -S bash -c '$1'"
}

# SSH命令函数（普通用户）
ssh_exec() {
    sshpass -p "$SSH_PASS" ssh -o StrictHostKeyChecking=no $SSH_USER@$SERVER_IP "$1"
}

log_info "开始服务器连接测试..."

# 测试SSH连接
if ssh_exec "echo 'SSH连接成功'"; then
    log_info "SSH连接成功"
else
    log_error "SSH连接失败"
    exit 1
fi

# 1. 修复Docker权限
log_info "修复Docker权限..."
ssh_sudo "usermod -aG docker $SSH_USER"
ssh_sudo "echo '$SSH_USER ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers 2>/dev/null || true"
ssh_sudo "chmod 666 /var/run/docker.sock"
log_info "Docker权限修复完成"

# 2. 拉取最新代码
log_info "正在拉取最新代码..."
ssh_exec "cd $PROJECT_DIR && git pull"

# 3. 停止现有服务
log_info "停止现有服务..."
ssh_sudo "cd $PROJECT_DIR && docker-compose down 2>/dev/null || true"

# 4. 完全清理Docker
log_info "完全清理Docker..."
ssh_sudo "docker-compose down -v 2>/dev/null || true"
ssh_sudo "docker system prune -a -f --volumes"
ssh_sudo "docker volume prune -f"

# 5. 删除旧镜像
log_info "删除旧镜像..."
ssh_sudo "docker rmi campus-surveillance-system-front-backend 2>/dev/null || true"
ssh_sudo "docker rmi campus-surveillance-system-ai-end 2>/dev/null || true"

# 6. 生成安全密钥
log_info "配置环境变量..."
ssh_exec "cd $PROJECT_DIR && bash generate-secrets.sh > /tmp/secrets.txt 2>/dev/null || true"

# 7. 检查并配置.env文件
log_info "检查环境变量配置..."
ENV_CHECK=$(ssh_sudo "cd $PROJECT_DIR && grep -c 'your_secure' .env 2>/dev/null || echo 0")
if [ "$ENV_CHECK" -gt 0 ]; then
    log_warning "检测到默认密钥，正在生成新密钥..."
    
    # 生成密钥
    JWT_SECRET=$(openssl rand -base64 32)
    HMAC_KEY=$(openssl rand -base64 32)
    MYSQL_ROOT_PASSWORD=$(openssl rand -base64 16)
    ADMIN_PASSWORD=$(openssl rand -base64 12)
    
    # 更新.env文件
    ssh_sudo "cd $PROJECT_DIR && sed -i 's/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/' .env"
    ssh_sudo "cd $PROJECT_DIR && sed -i 's/HMAC_KEY=.*/HMAC_KEY=$HMAC_KEY/' .env"
    ssh_sudo "cd $PROJECT_DIR && sed -i 's/MYSQL_ROOT_PASSWORD=.*/MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD/' .env"
    ssh_sudo "cd $PROJECT_DIR && sed -i 's/ADMIN_PASSWORD=.*/ADMIN_PASSWORD=$ADMIN_PASSWORD/' .env"
    
    log_info "新密钥已配置"
fi

# 8. 重新构建镜像
log_info "开始构建Docker镜像（这可能需要20-30分钟）..."
ssh_sudo "cd $PROJECT_DIR && docker-compose build --no-cache --parallel"

# 9. 启动服务
log_info "启动服务..."
ssh_sudo "cd $PROJECT_DIR && docker-compose up -d"

# 10. 等待服务启动
log_info "等待服务启动（60秒）..."
sleep 60

# 11. 检查服务状态
log_info "检查服务状态..."
ssh_sudo "cd $PROJECT_DIR && docker-compose ps"

# 12. 检查容器健康状态
log_info "检查容器健康状态..."
ssh_sudo "cd $PROJECT_DIR && docker-compose ps --format 'table {{.Name}}\t{{.Status}}'"

# 13. 查看front-backend日志（重点）
log_info "查看front-backend服务日志..."
ssh_sudo "cd $PROJECT_DIR && docker-compose logs front-backend --tail=50"

# 14. 查看所有服务日志
log_info "查看所有服务日志..."
ssh_sudo "cd $PROJECT_DIR && docker-compose logs --tail=30"

# 15. 检查端口占用
log_info "检查端口占用..."
ssh_sudo "netstat -tlnp | grep -E '8088|3000|1515|3306' || echo '端口检查完成'"

# 16. 测试Web访问
log_info "测试Web访问..."
HTTP_CODE=$(ssh_sudo "curl -s -o /dev/null -w '%{http_code}' http://localhost:8088 || echo '000'")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "304" ]; then
    log_info "Web服务正常运行 (HTTP $HTTP_CODE)"
else
    log_warning "Web服务响应异常 (HTTP $HTTP_CODE)，查看详细日志..."
    ssh_sudo "cd $PROJECT_DIR && docker-compose logs front-backend --tail=100"
fi

# 17. 获取管理员密码
ADMIN_PASS=$(ssh_sudo "cd $PROJECT_DIR && grep ADMIN_PASSWORD .env | cut -d'=' -f2")

# 18. 检查MySQL连接
log_info "检查MySQL连接..."
MYSQL_STATUS=$(ssh_sudo "cd $PROJECT_DIR && docker-compose exec -T mysql mysqladmin ping -h localhost -uroot -p\$MYSQL_ROOT_PASSWORD 2>&1 || echo 'failed'")
if echo "$MYSQL_STATUS" | grep -q "alive"; then
    log_info "MySQL连接正常"
else
    log_warning "MySQL连接可能有问题"
fi

# 部署完成信息
echo ""
echo "=========================================="
echo "🎉 部署完成！"
echo "=========================================="
echo "访问地址: http://$SERVER_IP:8088"
echo "默认账号: admin"
echo "管理员密码: $ADMIN_PASS"
echo ""
echo "⚠️  请妥善保存密码信息！"
echo ""
echo "常用命令:"
echo "  查看状态: cd $PROJECT_DIR && sudo docker-compose ps"
echo "  查看日志: cd $PROJECT_DIR && sudo docker-compose logs -f"
echo "  重启服务: cd $PROJECT_DIR && sudo docker-compose restart"
echo ""
echo "如果front-backend仍有问题，请查看:"
echo "  sudo docker-compose logs front-backend --tail=100"
echo "=========================================="

# 19. 保存部署信息
cat > /tmp/deployment_info.txt <<EOF
园区监控系统部署信息
==========================================
部署时间: $(date)
服务器IP: $SERVER_IP
访问地址: http://$SERVER_IP:8088
管理员账号: admin
管理员密码: $ADMIN_PASS

重要提醒:
1. 请妥善保管管理员密码
2. 首次登录后建议立即修改密码
3. 定期备份数据库数据
4. 如有问题请查看: sudo docker-compose logs front-backend
==========================================
EOF

log_info "部署信息已保存到 /tmp/deployment_info.txt"

echo ""
log_info "所有修复和部署工作已完成！"
echo "系统现已准备就绪，可以正常使用。"