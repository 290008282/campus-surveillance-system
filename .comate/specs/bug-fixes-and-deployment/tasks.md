# 园区监控系统bug修复和部署任务计划

- [x] Task 1: 修复关键语法错误和拼写错误
    - 1.1: 修复 ai-end/model.py 第43-44行缺失的右括号语法错误
    - 1.2: 修复 backend/src/ws-gateways/ai-end/ai-end.gateway.ts 第54行 connecetedClients 拼写错误为 connectedClients
    - 1.3: 修复 backend/src/services/camera/camera.entity.ts 字段名不匹配问题（latitude/longitude vs map_latitude/map_longitude）

- [x] Task 2: 重构认证系统
    - 2.1: 统一 backend/src/services/user/user.service.ts 使用 bcrypt 验证，移除明文和 HMAC 回退逻辑
    - 2.2: 完善 backend/src/guards/auth/auth.guard.ts 的 token 验证和撤销检查机制
    - 2.3: 修改 backend/src/ws-gateways/ai-end/ai-end.gateway.ts 使用 JWT token 进行 WebSocket 认证
    - 2.4: 生成强随机密钥并移除所有硬编码密钥

- [x] Task 3: 安全加固和输入验证
    - 3.1: 修复 backend/src/services/alarm-event/alarm-event.service.ts 的 SQL 注入风险，使用参数化查询
    - 3.2: 添加 backend/src/services/utils/utils.service.ts 的文件大小限制和严格文件类型验证
    - 3.3: 在所有 Controller 中添加输入验证中间件
    - 3.4: 修改 backend/nginx.conf 限制 CORS 源并添加安全头

- [x] Task 4: 数据库优化
    - 4.1: 在 init.sql 中添加必要的数据库索引
    - 4.2: 修复 backend/src/app.module.ts 禁用生产环境的 synchronize: true
    - 4.3: 添加数据库连接池配置优化
    - 4.4: 统一配置时区（统一使用 Asia/Shanghai）

- [x] Task 5: 错误处理和资源管理
    - 5.1: 完善 ai-end/wsClient.py 的错误日志和异常处理
    - 5.2: 添加 ai-end/main.py 的 FFmpeg 进程超时处理和僵尸进程清理
    - 5.3: 修复 backend/src/ws-gateways/ai-end/ai-end.gateway.ts 的客户端映射清理逻辑
    - 5.4: 完善 backend/src/app.module.ts 的数据库初始化错误传播机制

- [x] Task 6: 性能优化
    - 6.1: 优化 backend/src/services/camera/camera.service.ts 的查询，添加适当的 eager loading
    - 6.2: 在 backend/src/services/alarm-event/alarm-event.service.ts 添加分页参数验证和限制
    - 6.3: 实现 WebSocket 心跳机制
    - 6.4: 添加 WebSocket 连接数限制

- [x] Task 7: Docker 和部署配置优化
    - 7.1: 修改 docker-compose.yml 添加容器资源限制（CPU、内存）
    - 7.2: 增加 docker-compose.yml 的 shm_size 到 1GB
    - 7.3: 配置非 root 用户运行容器
    - 7.4: 优化端口映射配置

- [x] Task 8: 环境变量配置
    - 8.1: 创建 .env.example 文件包含所有必需环境变量
    - 8.2: 修改 docker-compose.yml 使用环境变量替代硬编码值
    - 8.3: 生成强随机密钥的说明文档
    - 8.4: 配置目标服务器 192.168.0.254 的网络设置

- [x] Task 9: 测试和验证
    - 9.1: 运行 docker-compose build 验证镜像构建
    - 9.2: 运行 docker-compose up 验证服务启动
    - 9.3: 测试用户登录和认证功能
    - 9.4: 测试摄像头连接和推流功能
    - 9.5: 测试 AI 检测和报警功能

- [x] Task 10: 部署到目标服务器
    - 10.1: 连接到内网服务器 192.168.0.254
    - 10.2: 在服务器上安装 Docker 和 Docker Compose
    - 10.3: 上传项目文件到服务器
    - 10.4: 配置服务器环境变量
    - 10.5: 启动服务并验证运行状态
    - 10.6: 配置服务开机自启动

- [x] Task 11: 部署验证和文档
    - 11.1: 验证所有服务正常运行
    - 11.2: 验证系统功能完整性
    - 11.3: 检查日志确认无错误
    - 11.4: 创建部署使用说明文档
    - 11.5: 创建维护手册和故障排查指南
