# 园区监控系统问题修复和部署

## 需求分析

用户要求：
1. 查看项目所有问题并找出所有bug
2. 解决所有发现的问题
3. 连接内网服务器 192.168.0.254
4. 通过 docker-compose 部署
5. 交付可运行的完整系统

## 问题清单

### 🔴 严重安全漏洞

#### 1. 认证授权问题
- **位置**: `backend/src/services/user/user.service.ts:31-56`
- **问题**: 使用多种密码回退比较逻辑，容易受到时间攻击
- **修复**: 统一使用 bcrypt 验证，移除明文和 HMAC 回退逻辑

#### 2. JWT Token 验证不足
- **位置**: `backend/src/guards/auth/auth.guard.ts:22-37`
- **问题**: 缺少 token 撤销检查，缓存比较可能静默失败
- **修复**: 添加完整的 token 验证和撤销检查机制

#### 3. WebSocket 认证弱点
- **位置**: `backend/src/ws-gateways/ai-end/ai-end.gateway.ts:109-158`
- **问题**: 管理员凭证以明文形式在 headers 中发送
- **修复**: 使用 JWT token 进行 WebSocket 认证

#### 4. 硬编码密钥
- **位置**:
  - `docker-compose.yml:33` - JWT_SECRET
  - `init.sql:6` - MySQL root 密码
  - `backend/src/app.module.ts:17` - HMAC 密钥
- **修复**: 使用环境变量，生成强随机密钥

#### 5. SQL 注入风险
- **位置**: `backend/src/services/alarm-event/alarm-event.service.ts:32-43`
- **问题**: LIKE 查询直接使用用户输入
- **修复**: 使用参数化查询或输入验证

#### 6. 文件上传安全问题
- **位置**: `backend/src/services/utils/utils.service.ts:22-34`
- **问题**: 没有文件大小限制，文件类型验证弱
- **修复**: 添加文件大小限制和严格文件类型验证

### 🟡 代码质量和错误处理问题

#### 7. 错误处理缺失
- **位置**: `ai-end/wsClient.py:155-178`
- **问题**: 静默失败，错误未正确记录
- **修复**: 添加适当的错误日志和异常处理

#### 8. 数据库操作失败处理
- **位置**: `backend/src/app.module.ts:128-130`
- **问题**: 初始化错误只记录不传播
- **修复**: 添加适当的错误传播和重试机制

#### 9. 内存泄漏风险
- **位置**: `ai-end/main.py:61-138`
- **问题**: FFmpeg 进程可能未正确清理
- **修复**: 添加超时处理和僵尸进程清理

#### 10. WebSocket 连接泄漏
- **位置**: `backend/src/ws-gateways/ai-end/ai-end.gateway.ts:54`
- **问题**: 连接失败时客户端映射未清理
- **修复**: 添加连接失败时的清理逻辑

### 🟠 配置和部署问题

#### 11. 数据库自动同步风险
- **位置**: `backend/src/app.module.ts:35`
- **问题**: 生产环境启用 synchronize: true
- **修复**: 生产环境禁用自动同步，使用迁移

#### 12. Nginx 安全问题
- **位置**: `backend/nginx.conf:72`
- **问题**: CORS 完全开放，缺少安全头
- **修复**: 限制 CORS 源，添加安全头

#### 13. Docker 配置问题
- **位置**: `docker-compose.yml:21-61`
- **问题**: 无资源限制，以 root 运行
- **修复**: 添加资源限制，使用非 root 用户

#### 14. 共享内存不足
- **位置**: `docker-compose.yml:26`
- **问题**: shm_size: '512m' 可能不够
- **修复**: 增加到 1GB 或更高

### 🔵 网络通信问题

#### 15. WebSocket 连接限制
- **位置**: `backend/src/ws-gateways/ai-end/ai-end.gateway.ts:35-39`
- **问题**: 无连接数限制
- **修复**: 添加连接数限制

#### 16. 缺少心跳机制
- **问题**: 死连接检测不及时
- **修复**: 实现 WebSocket 心跳机制

### 🟢 性能问题

#### 17. N+1 查询问题
- **位置**: `backend/src/services/camera/camera.service.ts:15-22`
- **问题**: 缺少适当的关联查询
- **修复**: 添加适当的 eager loading

#### 18. 缺少数据库索引
- **位置**: `init.sql:7-84`
- **问题**: 频繁查询字段无索引
- **修复**: 添加必要的数据库索引

#### 19. 前端性能问题
- **位置**: `frontend/src/pages/login/index.tsx:38-40`
- **问题**: Base64 图片存储
- **修复**: 使用文件存储替代

#### 20. 分页验证缺失
- **位置**: `backend/src/services/alarm-event/alarm-event.service.ts:30-31`
- **问题**: 无页面大小限制
- **修复**: 添加分页参数验证和限制

### 🟤 具体Bug和崩溃问题

#### 21. Python 模型语法错误
- **位置**: `ai-end/model.py:43-44`
- **问题**: 缺少右括号
- **修复**: 添加缺失的括号

#### 22. WebSocket 网关拼写错误
- **位置**: `backend/src/ws-gateways/ai-end/ai-end.gateway.ts:54`
- **问题**: `connecetedClients` 拼写错误
- **修复**: 修正为 `connectedClients`

#### 23. 摄像头实体不匹配
- **位置**: `backend/src/services/camera/camera.entity.ts:15-53`
- **问题**: 实体使用 latitude/longitude 但数据库使用 map_latitude/map_longitude
- **修复**: 统一字段命名

### 🟡 配置不一致问题

#### 24. 端口冲突
- **位置**: `docker-compose.yml:37-39`
- **问题**: 多服务暴露端口无适当隔离
- **修复**: 优化端口映射

#### 25. 时区不一致
- **位置**: `backend/src/app.module.ts:37`
- **问题**: 数据库使用 UTC，容器使用 Asia/Shanghai
- **修复**: 统一时区配置

## 修复策略

### 优先级 1 - 立即修复（阻断性问题）
1. Python 模型语法错误
2. WebSocket 网关拼写错误
3. 摄像头实体字段不匹配
4. JWT 密钥硬编码
5. MySQL 密码硬编码

### 优先级 2 - 高优先级（安全和稳定性）
6. 认证逻辑重构
7. 输入验证和 SQL 注入防护
8. 错误处理完善
9. 资源泄漏修复
10. CORS 和安全头配置

### 优先级 3 - 中优先级（性能和配置）
11. 数据库索引添加
12. N+1 查询优化
13. Docker 资源限制
14. 时区统一
15. 连接限制和心跳机制

### 优先级 4 - 低优先级（优化）
16. 性能优化
17. 监控和日志增强
18. 文档完善

## 技术方案

### 1. 认证系统重构
- 统一使用 bcrypt 进行密码验证
- 移除所有明文密码回退逻辑
- 实现 JWT token 刷新机制
- WebSocket 使用 JWT 认证

### 2. 数据库优化
- 添加必要索引
- 修复实体字段映射
- 禁用生产环境自动同步
- 实现数据库连接池配置

### 3. 安全加固
- 生成强随机密钥
- 实现 CORS 限制
- 添加安全头
- 实现输入验证
- 添加请求速率限制

### 4. 资源管理
- 修复内存泄漏
- 添加进程超时和清理
- 实现 Docker 资源限制
- 增加共享内存大小

### 5. 网络优化
- 实现 WebSocket 心跳
- 添加连接数限制
- 优化端口映射
- 统一时区配置

## 受影响文件

### 后端文件
- `backend/src/app.module.ts`
- `backend/src/guards/auth/auth.guard.ts`
- `backend/src/services/user/user.service.ts`
- `backend/src/services/camera/camera.entity.ts`
- `backend/src/services/alarm-event/alarm-event.service.ts`
- `backend/src/services/utils/utils.service.ts`
- `backend/src/ws-gateways/ai-end/ai-end.gateway.ts`

### AI端文件
- `ai-end/model.py`
- `ai-end/main.py`
- `ai-end/wsClient.py`

### 配置文件
- `docker-compose.yml`
- `init.sql`
- `backend/nginx.conf`

### 前端文件
- `frontend/src/pages/login/index.tsx`（如果需要）

## 部署配置

### 目标服务器
- IP: 192.168.0.254
- 部署方式: Docker Compose
- 数据持久化: Docker volumes

### 环境变量配置
```yaml
# MySQL
MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
MYSQL_DATABASE: campus-surveillance-system

# JWT
JWT_SECRET: ${JWT_SECRET}
JWT_EXPIRES_IN: 30d

# AI 端
HTTP_SERVER_URL: http://front-backend:3000
RTMP_SERVER_URL: rtmp://front-backend:1515/live
ADMIN_USERNAME: ${ADMIN_USERNAME}
ADMIN_PASSWORD: ${ADMIN_PASSWORD}
```

## 预期结果

1. **系统稳定性**: 所有已知bug修复，系统稳定运行
2. **安全性**: 修复所有安全漏洞，符合基本安全标准
3. **性能**: 优化查询和资源使用，提高响应速度
4. **可部署性**: 在 192.168.0.254 服务器成功部署并运行
5. **可维护性**: 完善的错误处理和日志记录

## 验证标准

1. 系统成功启动，所有容器正常运行
2. 用户可以正常登录和操作
3. 摄像头可以正常连接和推流
4. AI 检测正常工作，报警功能正常
5. 无内存泄漏，资源使用正常
6. 安全扫描无明显高危漏洞