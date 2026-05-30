#!/bin/bash

# 园区监控系统本地部署脚本
# 在服务器本地直接运行，无需SSH连接

set -e

# 配置变量
PROJECT_DIR="/www/campus-surveillance-system"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "================================"
echo "园区监控系统本地部署脚本"
echo "项目目录: $PROJECT_DIR"
echo "脚本目录: $SCRIPT_DIR"
echo "================================"

# 检查是否在正确的目录
if [ "$SCRIPT_DIR" != "$PROJECT_DIR" ]; then
    echo "⚠️  当前目录: $SCRIPT_DIR"
    echo "⚠️  项目目录: $PROJECT_DIR"
    echo "请先切换到项目目录: cd $PROJECT_DIR"
    exit 1
fi

# 检查Docker是否安装
echo "检查Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装"
    echo "请先安装Docker："
    echo "  Ubuntu/Debian: curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun"
    echo "  CentOS/RHEL: sudo yum install -y docker"
    exit 1
fi
echo "✅ Docker已安装: $(docker --version)"

# 检查Docker Compose是否安装
echo "检查Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose未安装"
    echo "请先安装Docker Compose："
    echo "  curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose"
    echo "  chmod +x /usr/local/bin/docker-compose"
    exit 1
fi
echo "✅ Docker Compose已安装: $(docker-compose --version)"

# 检查Docker服务是否运行
echo "检查Docker服务状态..."
if ! docker info &> /dev/null; then
    echo "❌ Docker服务未运行"
    echo "请启动Docker服务："
    echo "  sudo systemctl start docker"
    echo "  sudo systemctl enable docker"
    exit 1
fi
echo "✅ Docker服务运行正常"

# 生成环境变量文件（如果不存在）
if [ ! -f .env ]; then
    echo "环境变量文件不存在，生成配置文件..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ 已创建 .env 文件"
    else
        echo "❌ .env.example 文件不存在"
        exit 1
    fi
    
    echo ""
    echo "⚠️  重要提示："
    echo "1. 请编辑 .env 文件，设置正确的密钥和配置"
    echo "2. 运行: bash generate-secrets.sh 生成安全的密钥"
    echo "3. 将生成的密钥复制到 .env 文件中"
    echo ""
    read -p "按Enter继续编辑 .env 文件，或Ctrl+C取消..."
    
    # 尝试打开编辑器
    if command -v vi &> /dev/null; then
        vi .env
    elif command -v nano &> /dev/null; then
        nano .env
    else
        echo "请手动编辑 .env 文件"
        read -p "编辑完成后按Enter继续..."
    fi
fi

# 验证关键环境变量
echo "验证环境变量配置..."
source .env

if [ -z "$MYSQL_ROOT_PASSWORD" ] || [ "$MYSQL_ROOT_PASSWORD" = "your_secure_mysql_root_password_here" ]; then
    echo "⚠️  警告: MYSQL_ROOT_PASSWORD 使用了默认值，建议修改"
fi

if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "your_secure_jwt_secret_key_here_generate_with_openssl_rand_base64_32" ]; then
    echo "⚠️  警告: JWT_SECRET 使用了默认值，建议修改"
fi

if [ -z "$ADMIN_PASSWORD" ] || [ "$ADMIN_PASSWORD" = "your_secure_admin_password_here" ]; then
    echo "⚠️  警告: ADMIN_PASSWORD 使用了默认值，建议修改"
fi

echo "✅ 环境变量配置检查完成"

# 停止现有服务
echo "停止现有服务..."
docker-compose down 2>/dev/null || echo "没有运行中的服务"

# 清理旧镜像（可选）
read -p "是否清理旧Docker镜像？(y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "清理旧镜像..."
    docker system prune -f
fi

# 构建镜像
echo "构建Docker镜像（这可能需要10-20分钟）..."
docker-compose build --no-cache

if [ $? -ne 0 ]; then
    echo "❌ 镜像构建失败"
    exit 1
fi
echo "✅ 镜像构建成功"

# 启动服务
echo "启动服务..."
docker-compose up -d

if [ $? -ne 0 ]; then
    echo "❌ 服务启动失败"
    echo "请查看日志: docker-compose logs"
    exit 1
fi
echo "✅ 服务启动成功"

# 等待服务启动
echo "等待服务启动（30秒）..."
sleep 30

# 检查服务状态
echo "================================"
echo "服务状态检查"
echo "================================"
docker-compose ps

# 检查容器健康状态
echo ""
echo "容器健康状态："
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

# 检查服务日志
echo ""
echo "================================"
echo "最近日志（最后20行）"
echo "================================"
docker-compose logs --tail=20

# 获取服务器IP
SERVER_IP=$(hostname -I | awk '{print $1}')

# 部署完成信息
echo ""
echo "================================"
echo "🎉 部署完成！"
echo "================================"
echo "访问地址: http://${SERVER_IP}:8088"
echo "或者: http://localhost:8088"
echo ""
echo "默认账号: admin / admin"
echo "⚠️  首次登录后请立即修改密码！"
echo ""
echo "常用命令:"
echo "  查看服务状态: docker-compose ps"
echo "  查看日志: docker-compose logs -f"
echo "  重启服务: docker-compose restart"
echo "  停止服务: docker-compose down"
echo "  查看特定服务日志: docker-compose logs -f [service_name]"
echo ""
echo "故障排查:"
echo "  查看所有日志: docker-compose logs"
echo "  检查容器资源: docker stats"
echo "  进入容器: docker-compose exec [service_name] bash"
echo ""
echo "详细文档请参考: DEPLOYMENT_GUIDE.md"
echo "================================"