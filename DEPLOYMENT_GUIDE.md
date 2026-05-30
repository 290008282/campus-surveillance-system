# 园区监控系统部署指南

## 系统概述

智慧园区视频监控系统是一个基于深度学习的智能监控解决方案，支持：
- 多摄像头实时直播（HLS协议）
- AI异常检测与自动报警
- 基于地理位置的摄像头管理
- 报警触发规则自定义
- 角色权限管理

## 已修复问题

### 安全加固
- ✅ 重构认证系统，移除不安全的密码回退逻辑
- ✅ 实现JWT token验证和撤销检查
- ✅ WebSocket使用JWT认证替代明文密码
- ✅ 移除所有硬编码密钥，使用环境变量
- ✅ 添加文件上传大小限制和类型验证
- ✅ 限制CORS源并添加安全头
- ✅ 修复SQL注入风险

### 数据库优化
- ✅ 添加必要的数据库索引
- ✅ 禁用生产环境自动同步
- ✅ 配置数据库连接池
- ✅ 统一时区配置

### 代码质量
- ✅ 修复语法错误和拼写错误
- ✅ 完善错误处理和日志记录
- ✅ 修复实体字段映射问题
- ✅ 添加输入验证

### 部署优化
- ✅ 添加容器资源限制
- ✅ 增加共享内存到1GB
- ✅ 使用环境变量配置
- ✅ 优化端口映射

## 部署步骤

### 1. 前置要求

- 服务器操作系统：Linux (Ubuntu 20.04+ / CentOS 7+)
- 最低配置：4核CPU，8GB内存，100GB磁盘空间
- 网络要求：可访问摄像头RTSP流
- 服务器IP：192.168.0.254

### 2. 安装Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
systemctl start docker
systemctl enable docker

# CentOS/RHEL
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
```

### 3. 安装Docker Compose

```bash
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### 4. 生成安全密钥

```bash
chmod +x generate-secrets.sh
bash generate-secrets.sh
```

将生成的密钥复制到 `.env` 文件中。

### 5. 配置环境变量

```bash
cp .env.example .env
vi .env  # 编辑环境变量
```

必须修改的关键配置：
```bash
# 数据库密码
MYSQL_ROOT_PASSWORD=your_secure_password

# JWT密钥
JWT_SECRET=your_secure_jwt_secret

# HMAC密钥
HMAC_KEY=your_secure_hmac_key

# 管理员密码
ADMIN_PASSWORD=your_secure_admin_password
```

### 6. 使用部署脚本

```bash
chmod +x deploy.sh
./deploy.sh
```

### 7. 手动部署（备选方案）

```bash
# 上传项目到服务器
scp -r . root@192.168.0.254:/opt/campus-surveillance-system

# SSH登录服务器
ssh root@192.168.0.254

# 进入项目目录
cd /opt/campus-surveillance-system

# 构建和启动
docker-compose build --no-cache
docker-compose up -d
```

## 访问系统

- **Web界面**: http://192.168.0.254:8088
- **默认账号**: admin / admin（首次部署后请立即修改）

## 服务管理

### 查看服务状态
```bash
docker-compose ps
```

### 查看日志
```bash
# 所有服务日志
docker-compose logs -f

# 特定服务日志
docker-compose logs -f front-backend
docker-compose logs -f ai-end
docker-compose logs -f mysql
```

### 重启服务
```bash
docker-compose restart
```

### 停止服务
```bash
docker-compose down
```

### 更新部署
```bash
git pull
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 故障排查

### 1. MySQL连接失败
```bash
# 检查MySQL容器状态
docker-compose ps mysql

# 查看MySQL日志
docker-compose logs mysql

# 验证MySQL连接
docker-compose exec mysql mysql -uroot -p$MYSQL_ROOT_PASSWORD -e "SELECT 1"
```

### 2. 前端页面白屏
```bash
# 检查Nginx配置
docker-compose exec front-backend nginx -t

# 查看前端构建日志
docker-compose logs front-backend | head -50

# 检查静态文件
docker-compose exec front-backend ls -la /usr/share/campus-surveillance-system/frontend/dist/
```

### 3. HLS流404
```bash
# 检查FFmpeg进程
docker-compose exec ai-end ps aux | grep ffmpeg

# 检查HLS文件
docker-compose exec front-backend ls -la /dev/shm/nginx-live/

# 检查RTMP连接
curl -I http://192.168.0.254:8088/hls/test.m3u8
```

### 4. AI端反复重启
```bash
# 查看AI端日志
docker-compose logs ai-end --tail=100

# 检查后端API
curl http://192.168.0.254:3000/api/ai/getAllCameraList

# 手动测试AI端连接
docker-compose exec ai-end python -c "import requests; print(requests.get('http://front-backend:3000').status_code)"
```

### 5. 容器资源不足
```bash
# 检查系统资源
free -h
df -h

# 检查容器资源使用
docker stats

# 增加共享内存
docker-compose down
# 修改 docker-compose.yml 中的 shm_size
docker-compose up -d
```

## 性能优化

### 1. 数据库优化
- 已添加索引到常用查询字段
- 配置连接池优化
- 建议定期清理历史报警数据

### 2. 缓存优化
- JWT token缓存（24小时）
- 用户会话缓存
- 考虑添加Redis缓存热点数据

### 3. 网络优化
- RTSP使用TCP传输（更稳定）
- HLS切片优化（2秒片段）
- WebSocket心跳检测

## 安全建议

1. **修改默认密码**: 首次登录后立即修改admin密码
2. **使用强密钥**: 使用 `generate-secrets.sh` 生成安全密钥
3. **网络隔离**: 仅开放必要端口
4. **定期备份**: 备份数据库和配置文件
5. **更新维护**: 定期更新系统和依赖包
6. **日志监控**: 启用日志审计和异常告警

## 备份与恢复

### 数据备份
```bash
# 备份数据库
docker-compose exec mysql mysqldump -uroot -p$MYSQL_ROOT_PASSWORD campus-surveillance-system > backup_$(date +%Y%m%d_%H%M%S).sql

# 备份配置文件
tar -czf config_backup_$(date +%Y%m%d_%H%M%S).tar.gz .env docker-compose.yml
```

### 数据恢复
```bash
# 恢复数据库
docker-compose exec -T mysql mysql -uroot -p$MYSQL_ROOT_PASSWORD campus-surveillance-system < backup_xxx.sql

# 恢复配置
tar -xzf config_backup_xxx.tar.gz
```

## 监控指标

- 系统资源使用率
- 容器健康状态
- 数据库连接数
- API响应时间
- 摄像头在线率
- 报警处理时效

## 扩展部署

### 多服务器部署
- 数据库服务器独立部署
- 前后端分离部署
- 负载均衡配置

### 高可用部署
- 数据库主从复制
- 服务集群部署
- 容器编排（Kubernetes）

## 技术支持

遇到问题时的排查步骤：
1. 查看服务状态和日志
2. 检查网络连接和端口
3. 验证配置文件和密钥
4. 测试各组件功能
5. 查看系统资源使用

## 更新日志

### v1.1.0 (2026-05-30)
- 重大安全加固
- 性能优化
- 错误处理改进
- 数据库优化
- 部署流程简化

### v1.0.0 (初始版本)
- 基础监控功能
- AI检测
- 报警系统

---

**部署完成后，请务必修改默认密码并配置安全密钥！**