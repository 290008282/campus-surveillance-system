# 智慧园区视频监控系统 - Docker 部署指南

## 修复内容

### 已完成的修复

1. **docker-compose.yml** - 统一管理所有服务
2. **init.sql** - 数据库初始化脚本
3. **user.service.ts** - 修复登录验证（支持 bcrypt）
4. **app.module.ts** - 添加自动初始化默认数据

---

## 快速部署

### 前置要求

- Docker Desktop
- Docker Compose

### 部署步骤

#### 1. 拉取项目（已修复版本）
```bash
git clone https://github.com/290008282/campus-surveillance-system.git
cd campus-surveillance-system
```

#### 2. 构建并启动所有服务
```bash
docker-compose up -d --build
```

#### 3. 查看服务状态
```bash
docker-compose ps
```

#### 4. 查看日志
```bash
docker-compose logs -f
```

---

## 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| **前端** | http://localhost:8080 | Web 界面 |
| **RTMP** | rtmp://localhost:1515/live | 直播流 |
| **MySQL** | localhost:3306 | 数据库 |

---

## 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| **管理员** | admin | admin |
| **普通用户** | (注册) | (注册) |

---

## 遇到问题？

### 问题 1: MySQL 连接失败
```bash
# 检查 MySQL 容器状态
docker-compose ps mysql
docker-compose logs mysql
```

### 问题 2: 后端启动失败
```bash
# 查看后端日志
docker-compose logs backend
```

### 问题 3: 端口被占用
```bash
# 查看端口占用
netstat -ano | findstr "8080 3306 1515"
```

修改 `docker-compose.yml` 中的端口映射：

```yaml
ports:
  - "8081:80"  # 改成 8081
  - "1516:1935"  # 改成 1516
```

---

## 项目结构

```
campus-surveillance-system/
├── docker-compose.yml     # 部署配置 ✓ 已修复
├── init.sql              # 数据库初始化 ✓ 已修复
├── backend/
│   ├── Dockerfile
│   ├── server.config.env
│   └── src/
│       ├── app.module.ts    # 初始化 ✓ 已修复
│       └── services/user/
│           └── user.service.ts  # 登录验证 ✓ 已修复
├── frontend/             # 前端 (构建)
├── ai-end/               # AI 端 (Python)
└── docs/                 # 文档
```

---

## 手动部署（分步）

如果 `docker-compose up` 构建失败，可以分步部署：

### 1. 启动 MySQL
```bash
docker run -d \
  --name campus-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=campus-surveillance-system \
  -p 3306:3306 \
  -v ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro \
  mysql:8.0
```

### 2. 启动后端
```bash
cd backend
docker build -t campus-backend .
docker run -d \
  --name campus-backend \
  -e MYSQL_HOST=host.docker.internal \
  -e MYSQL_PORT=3306 \
  -e MYSQL_DATABASE=campus-surveillance-system \
  -e MYSQL_USER=root \
  -e MYSQL_PASSWORD=root \
  -e JWT_SECRET= campus-secret-key \
  -p 3000:3000 \
  campus-backend
```

### 3. 启动前端+Nginx
```bash
docker build -f front-backend.Dockerfile -t campus-frontend .
docker run -d \
  --name campus-frontend \
  -p 8080:80 \
  -p 1515:1935 \
  campus-frontend
```

---

## AI 端配置

AI 端需要正确连接到后端：

```bash
docker run -d \
  --name campus-ai-end \
  -e HTTP_SERVER_URL=http://host.docker.internal:3000 \
  -e RTMP_SERVER_URL=rtmp://host.docker.internal:1515/live \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=admin \
  campus-ai-end
```

> 注意: Windows 上使用 `host.docker.internal`，Linux 上使用 IP 地址

---

## 验证部署成功

1. 访问 http://localhost:8080
2. 使用 admin/admin 登录
3. 检查摄像头管理页面

---

## 自定义修改

### 修改管理员密码
```bash
# 进入后端容器
docker exec -it campus-backend sh

# 使用 Node.js 创建密码哈希
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your-password', 10).then(p => console.log(p));"
```

然后在数据库中更新：
```sql
UPDATE users SET password = '新哈希值' WHERE username = 'admin';
```

### 修改 JWT Secret
在 `docker-compose.yml` 中修改：
```yaml
environment:
  JWT_SECRET: your-secret-key
```

---

## 技术支持

如有问题，请检查：
1. Docker Desktop 是否运行
2. 端口 8080/3306/1515 是否被占用
3. MySQL 容器是否健康启动