# 智慧园区视频监控系统 - Docker 部署指南

## 修复内容

### 已完成的修复

1. **docker-compose.yml** - 统一管理所有服务，添加 shm_size: 512m 支持 HLS 切片存储
2. **init.sql** - 数据库初始化脚本，含默认管理员账户
3. **user.service.ts** - 修复登录验证（支持 bcrypt + 明文兼容）
4. **app.module.ts** - 添加自动初始化默认数据
5. **nginx.conf** - HLS 参数优化、worker_connections 4096、alias 路径修复
6. **ai-end/main.py** - 持续监控模式、FFmpeg -an 禁用音频、HEVC 容错、进程自动重启
7. **common.controller.ts** - 新增 getAllCameraList API 端点
8. **报警去重** - 节流 300s、检测间隔 2s
9. **批量操作** - 批量确认和删除报警事件

---

## 快速部署

### 前置要求

- Docker & Docker Compose
- 至少 2GB 可用磁盘空间（AI 模型依赖）
- 网络可访问摄像头 RTSP 流

### 部署步骤

#### 1. 拉取项目

```bash
git clone https://github.com/290008282/campus-surveillance-system.git
cd campus-surveillance-system
```

#### 2. 配置环境变量（可选）

编辑 `docker-compose.yml` 中的环境变量：

```yaml
# MySQL
MYSQL_ROOT_PASSWORD: root
MYSQL_DATABASE: campus-surveillance-system

# 后端
JWT_SECRET: your-secret-key

# AI 端
HTTP_SERVER_URL: http://front-backend:3000
RTMP_SERVER_URL: rtmp://front-backend:1515/live
ADMIN_USERNAME: admin
ADMIN_PASSWORD: admin
HLS_HOST: 192.168.0.254  # 改为实际服务器 IP
```

#### 3. 构建并启动所有服务

```bash
docker compose build --no-cache
docker compose up -d
```

> ⚠️ 首次构建较慢（AI 端需下载 PyTorch 等），预计 10-20 分钟

#### 4. 查看服务状态

```bash
docker compose ps
docker compose logs -f
```

---

## 服务说明

| 服务 | 容器名 | 端口 | 说明 |
|------|--------|------|------|
| **前端 + 后端 + Nginx** | campus-front-backend | 8088:80, 1515:1515 | Web 界面 + API + RTMP/HLS |
| **AI 检测端** | campus-ai-end | - | YOLOv8 目标检测 + FFmpeg 推流 |
| **MySQL** | campus-mysql | 3306:3306 | 数据库 |

---

## 访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| **Web 管理界面** | http://SERVER_IP:8088 | 前端页面 |
| **HLS 直播流** | http://SERVER_IP:8088/hls/CAMERA_ID.m3u8 | 摄像头直播 |
| **RTMP 推流** | rtmp://SERVER_IP:1515/live | FFmpeg 推流地址 |
| **MySQL** | SERVER_IP:3306 | 数据库直连 |

---

## 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| **管理员** | admin | admin |
| **普通用户** | (注册) | (注册) |

---

## 常见问题

### 问题 1: MySQL 连接失败

```bash
docker compose logs mysql
# 确认 MySQL 容器健康
docker compose exec mysql mysql -uroot -proot -e "SELECT 1"
```

### 问题 2: 前端页面白屏或 294 字节

前端构建失败会导致 Nginx 返回默认页。检查构建日志：

```bash
docker compose logs front-backend | head -50
```

确保 `dist/index.html` 大小 > 1KB。

### 问题 3: HLS 直播流 404

1. 确认 FFmpeg 进程运行：`docker compose exec ai-end ps aux | grep ffmpeg`
2. 检查 HLS 文件：`docker compose exec front-backend ls -la /dev/shm/nginx-live/`
3. 确认 nginx alias 路径以 `/` 结尾

### 问题 4: AI 端反复重启

1. 查看日志：`docker compose logs ai-end --tail 100`
2. 常见原因：Python 语法错误、依赖缺失
3. 确认 `getAllCameraList` API 返回摄像头列表

### 问题 5: HEVC 摄像头解码错误

H.265 摄像头可能出现解码警告，FFmpeg 已添加容错参数：

```
-err_detect ignore_err -fflags +discardcorrupt+genpts+igndts
```

### 问题 6: /dev/shm 空间不足

docker-compose.yml 已配置 `shm_size: '512m'`。如仍不足：

```bash
# 临时扩大
mount -o remount,size=1G /dev/shm
```

### 问题 7: 端口被占用

```bash
# 查看端口占用
ss -tlnp | grep -E "8088|3306|1515"
```

修改 `docker-compose.yml` 中的端口映射。

---

## 项目结构

```
campus-surveillance-system/
├── docker-compose.yml          # 编排配置
├── front-backend.Dockerfile    # 前端+后端+Nginx 镜像
├── ai-end.Dockerfile           # AI 检测端镜像
├── init.sql                    # 数据库初始化
├── backend/
│   ├── nginx.conf              # Nginx + RTMP 配置
│   ├── server.config.env       # 后端环境变量
│   └── src/
│       ├── app.module.ts
│       ├── controllers/        # API 路由
│       │   └── common.controller.ts
│       ├── services/
│       │   ├── camera/         # 摄像头服务
│       │   ├── user/           # 用户认证
│       │   └── alarm-event/    # 报警事件
│       └── types/
│           └── fetchTypes.d.ts # API 类型定义
├── frontend/
│   └── src/                    # UmiJS + React 前端
├── ai-end/
│   ├── main.py                 # 入口：FFmpeg + YOLOv8
│   ├── wsClient.py             # WebSocket 客户端
│   └── requirements.txt        # Python 依赖
└── docs/                       # 文档和截图
```

---

## 更新部署

```bash
cd /www/campus-surveillance-system
git fetch origin
git reset --hard origin/main
docker compose down
docker compose build --no-cache
docker compose up -d --force-recreate
```

> ⚠️ `docker compose down` 会清除数据卷，如需保留数据请备份。

---

## 技术支持

如有问题，请检查：

1. Docker 服务是否正常运行
2. 端口 8088/3306/1515 是否被占用
3. MySQL 容器是否健康
4. AI 端日志是否有 Python 错误
5. HLS 目录是否有 .m3u8 和 .ts 文件
