<div align="center">

# 🏫 智慧园区视频监控系统

**基于服务器本地地图和深度学习的智能园区视频监控 Web 系统**

[![Docker](https://img.shields.io/badge/Docker-Compose-blue?logo=docker)](https://docs.docker.com/compose/)
[![Python](https://img.shields.io/badge/Python-3.10-yellow?logo=python)](https://python.org)
[![NestJS](https://img.shields.io/badge/NestJS-Backend-red?logo=nestjs)](https://nestjs.com)
[![React](https://img.shields.io/badge/React-Frontend-61dafb?logo=react)](https://react.dev)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-AI%20Detection-00ffff?logo=pytorch)](https://ultralytics.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[功能特性](#-功能特性) · [快速开始](#-快速开始) · [系统架构](#-系统架构) · [部署指南](docs/../DEPLOY.md) · [API 文档](#-api-端点)

</div>

---

## 📖 简介

传统园区视频监控系统不存储园区 GIS 地图，也没有精确记录摄像头的地理位置和相对位置关系，不便于监控调取和管理。同时，传统系统还需人工值守监视画面并研判上报事件，限制了易用性、实时性和效率。

本系统通过**服务器本地地图**、**HLS 低延迟直播**和**YOLOv8 深度学习检测**，实现：

- 🗺️ 园区自定义地图的本地存储、加载和渲染
- 📹 多摄像头实时直播（HLS 协议，秒级延迟）
- 📍 基于地理位置的摄像头管理
- 🤖 AI 实时异常检测与自动报警
- ⚙️ 报警触发规则自定义
- 👥 角色权限管理

## 📸 功能截图

| 登录页 | 园区态势 |
|:---:|:---:|
| ![登录页](docs/login-page.png) | ![园区态势](docs/campus-status-page.png) |

| 监控大屏 | 异常报警 |
|:---:|:---:|
| ![监控大屏](docs/monit-screen.png) | ![报警事件](docs/alarms-page.png) |

| 地图管理 | 摄像头管理 | 报警规则 |
|:---:|:---:|:---:|
| ![地图管理](docs/map-manage-page.png) | ![摄像头管理](docs/cameras-manage.png) | ![报警规则](docs/alarm-rules-page-config.png) |

---

## 🚀 快速开始

### 前置要求

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose v2+
- 2GB+ 可用磁盘空间
- 网络可访问摄像头 RTSP 流

### 一键部署

```bash
git clone https://github.com/290008282/campus-surveillance-system.git
cd campus-surveillance-system
docker compose up -d --build
```

### 访问系统

- 🌐 **管理界面**：http://localhost:8088
- 🔑 **默认账号**：admin / admin

> 📖 详细部署说明请参阅 [DEPLOY.md](DEPLOY.md)

---

## 🏗️ 系统架构

### 技术架构

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend (Nest) │────▶│    MySQL     │
│  UmiJS+React │     │   HTTP + WS      │     │    8.0       │
└─────────────┘     └────────┬─────────┘     └──────────────┘
       ▲                     │
       │                     │ WebSocket
       │                     ▼
       │              ┌──────────────┐
       │              │    AI End    │
       │              │ Python+YOLOv8│
       │              └──────┬───────┘
       │                     │ FFmpeg
       │                     ▼
       │              ┌──────────────┐
       └──────────────│  nginx-rtmp  │
         HLS Stream   │ RTMP → HLS   │
                      └──────────────┘
```

### 核心流程

1. **AI 端**通过 WebSocket 连接后端，获取摄像头列表
2. 为每个摄像头启动 **FFmpeg** 子进程：RTSP → RTMP 推流
3. **nginx-rtmp** 将 RTMP 转为 HLS 切片（.m3u8 + .ts）
4. **前端**通过 hls.js 播放 HLS 直播流
5. 同时 **YOLOv8** 对画面进行实时目标检测，异常时通过 WebSocket 上报报警

### 组件说明

| 组件 | 技术栈 | 说明 |
|------|--------|------|
| **前端** | UmiJS + React + Leaflet + hls.js | 管理界面、地图渲染、直播播放 |
| **后端** | NestJS + TypeORM + Socket.IO | REST API、WebSocket、数据库操作 |
| **AI 端** | Python + YOLOv8 + FFmpeg | 目标检测、RTSP→RTMP 推流、报警上报 |
| **媒体服务** | nginx-rtmp | RTMP 收流、HLS 切片分发 |
| **数据库** | MySQL 8.0 | 用户、摄像头、报警事件等数据存储 |

---

## 📡 API 端点

### 用户认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/user/login` | 用户登录 |

### 摄像头

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/user/getCameraInfo` | 获取摄像头信息 |
| GET | `/api/ai/getOfflineCameraList` | 获取离线摄像头列表 |
| GET | `/api/ai/getAllCameraList` | 获取所有摄像头列表 |

### AI 端通信

AI 端通过 WebSocket (`/ws/ai/socket.io`) 与后端实时通信：

- 摄像头列表同步（每 60 秒）
- 进程存活检查（每 30 秒）
- 异常事件实时上报
- 报警去重（节流 300 秒）

---

## ⚙️ 环境变量

### AI 端

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `HTTP_SERVER_URL` | `http://front-backend:3000` | 后端地址 |
| `RTMP_SERVER_URL` | `rtmp://front-backend:1515/live` | RTMP 推流地址 |
| `ADMIN_USERNAME` | `admin` | 管理员用户名 |
| `ADMIN_PASSWORD` | `admin` | 管理员密码 |
| `HLS_HOST` | `localhost` | HLS 流地址（跨设备访问需设为实际 IP） |

### 后端

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MYSQL_HOST` | `mysql` | MySQL 主机 |
| `MYSQL_PORT` | `3306` | MySQL 端口 |
| `MYSQL_DATABASE` | `campus-surveillance-system` | 数据库名 |
| `MYSQL_USER` | `root` | 数据库用户 |
| `MYSQL_PASSWORD` | `root` | 数据库密码 |
| `JWT_SECRET` | `campus-secret-key` | JWT 签名密钥 |

---

## 🔧 已知问题与解决方案

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| HEVC 摄像头解码警告 | H.265 编码不完全兼容 | FFmpeg 添加 `-err_detect ignore_err` 容错 |
| HLS 流 404 | nginx alias 缺尾部斜杠 | 已修复：`location /hls/ { alias /dev/shm/nginx-live/; }` |
| /dev/shm 空间不足 | 默认 64MB 不够 3 路流 | docker-compose.yml 添加 `shm_size: '512m'` |
| FFmpeg 音频不兼容 | FLV 不支持 8000Hz MP3 | FFmpeg 添加 `-an` 禁用音频 |
| 宿主机 80 端口被占 | 宝塔面板占 80 | 使用 8088 端口映射 |

---

## 📂 项目结构

```
campus-surveillance-system/
├── docker-compose.yml          # 服务编排
├── front-backend.Dockerfile    # 前端+后端+RTMP 镜像
├── ai-end.Dockerfile           # AI 检测端镜像
├── init.sql                    # 数据库初始化
├── DEPLOY.md                   # 部署指南
├── backend/
│   ├── nginx.conf              # Nginx + RTMP + HLS 配置
│   ├── server.config.env
│   └── src/
│       ├── controllers/
│       ├── services/           # camera / user / alarm-event
│       └── types/
├── frontend/
│   └── src/                    # UmiJS + React
├── ai-end/
│   ├── main.py                 # FFmpeg 推流 + YOLOv8 检测
│   ├── wsClient.py             # WebSocket 客户端
│   └── requirements.txt
└── docs/                       # 截图和文档
```

---

## 🤝 致谢

本项目 Fork 自 [CrazyHer/campus-surveillance-system](https://github.com/CrazyHer/campus-surveillance-system)，基于 MIT 协议开源。

## 📄 许可证

[MIT License](LICENSE)
