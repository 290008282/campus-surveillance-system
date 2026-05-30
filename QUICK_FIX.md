# 园区监控系统快速修复部署指南

## 🚀 一键自动修复部署

### 方式一：使用自动化脚本（推荐）

```bash
# 1. 在服务器上拉取最新代码
cd /www/campus-surveillance-system
git pull

# 2. 运行自动化修复脚本
bash auto-fix-deploy.sh
```

**自动化脚本会完成：**
- ✅ 拉取最新代码（包含所有修复）
- ✅ 停止现有服务
- ✅ 清理Docker缓存
- ✅ 生成安全密钥
- ✅ 重新构建镜像
- ✅ 启动服务
- ✅ 检查服务健康
- ✅ 输出访问信息和密码

### 方式二：手动快速修复

```bash
cd /www/campus-surveillance-system

# 1. 拉取最新修复代码
git pull

# 2. 完全重建
docker-compose down
docker system prune -f
docker-compose build --no-cache
docker-compose up -d

# 3. 等待启动（60秒）
sleep 60

# 4. 检查状态
docker-compose ps
docker-compose logs --tail=30
```

## 🎯 已修复的问题

### 1. UmiJS MPA配置错误 ✅
- **问题**: `mpa: true` 导致配置验证失败
- **修复**: 改为 `mpa: {}` 空对象
- **影响文件**: `frontend/.umirc.ts`

### 2. TypeScript编译错误 ✅
- **问题**: Camera实体缺少model字段，hmacSha256调用错误
- **修复**: 添加model字段，修正函数调用
- **影响文件**: `camera.entity.ts`, `user.service.ts`

### 3. 认证系统安全加固 ✅
- **问题**: 多重密码验证逻辑不安全
- **修复**: 统一bcrypt验证，JWT认证
- **影响文件**: `user.service.ts`, `auth.guard.ts`, `ai-end.gateway.ts`

### 4. 数据库优化 ✅
- **问题**: 缺少索引，性能不佳
- **修复**: 添加所有表索引，连接池配置
- **影响文件**: `init.sql`, `app.module.ts`

## 🌐 访问信息

部署完成后：
- **Web界面**: http://192.168.0.254:8088
- **默认账号**: admin
- **默认密码**: （运行脚本后显示）

## ⚡ 快速验证

```bash
# 检查服务状态
docker-compose ps

# 测试Web访问
curl -I http://192.168.0.254:8088

# 查看日志
docker-compose logs -f
```

## 🛠️ 常见问题处理

### 问题1: 拉取代码失败
```bash
# 重置git仓库
cd /www/campus-surveillance-system
git fetch --all
git reset --hard origin/main
git pull
```

### 问题2: 构建失败
```bash
# 清理缓存重新构建
docker-compose down
docker system prune -a -f
docker-compose build --no-cache
```

### 问题3: 服务启动失败
```bash
# 查看详细日志
docker-compose logs --tail=100

# 重启服务
docker-compose restart
```

## 📊 预期部署时间

- **代码拉取**: < 1分钟
- **缓存清理**: 2-3分钟
- **镜像构建**: 15-20分钟
- **服务启动**: 2-3分钟
- **总计**: 约20-25分钟

## 🎉 完成标准

部署成功后应该看到：
- ✅ 所有容器状态为 `Up`
- ✅ Web页面可正常访问
- ✅ 可以登录系统
- ✅ 无严重错误日志

---

**📞 如有问题，请提供错误日志进行诊断。**

**🚀 立即执行: `cd /www/campus-surveillance-system && bash auto-fix-deploy.sh`**