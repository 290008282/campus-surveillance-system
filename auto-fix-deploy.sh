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

# SSH命令函数
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

# 1. 拉取最新代码
log_info "正在拉取最新代码..."
ssh_exec "cd $PROJECT_DIR && git pull"

# 2. 停止现有服务
log_info "停止现有服务..."
ssh_exec "cd $PROJECT_DIR && docker-compose down"

# 3. 清理Docker缓存和旧镜像
log_info "清理Docker缓存..."
ssh_exec "docker system prune -f"

# 4. 生成安全密钥（如果.env不存在或使用默认值）
log_info "配置环境变量..."
ssh_exec "cd $PROJECT_DIR && bash generate-secrets.sh > /tmp/secrets.txt"

# 5. 检查并配置.env文件
log_info "检查环境变量配置..."
ENV_CHECK=$(ssh_exec "cd $PROJECT_DIR && grep -c 'your_secure' .env || true")
if [ "$ENV_CHECK" -gt 0 ]; then
    log_warning "检测到默认密钥，正在生成新密钥..."
    
    # 生成密钥
    JWT_SECRET=$(openssl rand -base64 32)
    HMAC_KEY=$(openssl rand -base64 32)
    MYSQL_ROOT_PASSWORD=$(openssl rand -base64 16)
    ADMIN_PASSWORD=$(openssl rand -base64 12)
    
    # 更新.env文件
    ssh_exec "cd $PROJECT_DIR && sed -i 's/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/' .env"
    ssh_exec "cd $PROJECT_DIR && sed -i 's/HMAC_KEY=.*/HMAC_KEY=$HMAC_KEY/' .env"
    ssh_exec "cd $PROJECT_DIR && sed -i 's/MYSQL_ROOT_PASSWORD=.*/MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD/' .env"
    ssh_exec "cd $PROJECT_DIR && sed -i 's/ADMIN_PASSWORD=.*/ADMIN_PASSWORD=$ADMIN_PASSWORD/' .env"
    
    log_info "新密钥已配置"
fi

# 6. 重新构建镜像
log_info "开始构建Docker镜像（这可能需要20-30分钟）..."
ssh_exec "cd $PROJECT_DIR && docker-compose build --no-cache"

# 7. 启动服务
log_info "启动服务..."
ssh_exec "cd $PROJECT_DIR && docker-compose up -d"

# 8. 等待服务启动
log_info "等待服务启动（60秒）..."
sleep 60

# 9. 检查服务状态
log_info "检查服务状态..."
ssh_exec "cd $PROJECT_DIR && docker-compose ps"

# 10. 检查服务健康状态
log_info "检查容器健康状态..."
ssh_exec "cd $PROJECT_DIR && docker-compose ps --format 'table {{.Name}}\t{{.Status}}'"

# 11. 查看日志
log_info "查看服务日志..."
ssh_exec "cd $PROJECT_DIR && docker-compose logs --tail=30"

# 12. 测试Web访问
log_info "测试Web访问..."
HTTP_CODE=$(ssh_exec "curl -s -o /dev/null -w '%{http_code}' http://localhost:8088 || echo '000'")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "304" ]; then
    log_info "Web服务正常运行 (HTTP $HTTP_CODE)"
else
    log_warning "Web服务响应异常 (HTTP $HTTP_CODE)"
fi

# 13. 获取管理员密码
ADMIN_PASS=$(ssh_exec "cd $PROJECT_DIR && grep ADMIN_PASSWORD .env | cut -d'=' -f2")

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
echo "  查看状态: ssh $SSH_USER@$SERVER_IP 'cd $PROJECT_DIR && docker-compose ps'"
echo "  查看日志: ssh $SSH_USER@$SERVER_IP 'cd $PROJECT_DIR && docker-compose logs -f'"
echo "  重启服务: ssh $SSH_USER@$SERVER_IP 'cd $PROJECT_DIR && docker-compose restart'"
echo ""
echo "=========================================="

# 14. 保存部署信息
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
==========================================
EOF

log_info "部署信息已保存到 /tmp/deployment_info.txt"

echo ""
log_info "所有修复和部署工作已完成！"
echo "系统现已准备就绪，可以正常使用。"