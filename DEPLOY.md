# 鏅烘収鍥尯瑙嗛鐩戞帶绯荤粺 - Docker 閮ㄧ讲鎸囧崡

## 淇鍐呭

### 宸插畬鎴愮殑淇

1. **docker-compose.yml** - 缁熶竴绠＄悊鎵€鏈夋湇鍔?2. **init.sql** - 鏁版嵁搴撳垵濮嬪寲鑴氭湰
3. **user.service.ts** - 淇鐧诲綍楠岃瘉锛堟敮鎸?bcrypt锛?4. **app.module.ts** - 娣诲姞鑷姩鍒濆鍖栭粯璁ゆ暟鎹?
---

## 蹇€熼儴缃?
### 鍓嶇疆瑕佹眰

- Docker Desktop
- Docker Compose

### 閮ㄧ讲姝ラ

#### 1. 鎷夊彇椤圭洰锛堝凡淇鐗堟湰锛?```bash
git clone https://github.com/290008282/campus-surveillance-system.git
cd campus-surveillance-system
```

#### 2. 鏋勫缓骞跺惎鍔ㄦ墍鏈夋湇鍔?```bash
docker-compose up -d --build
```

#### 3. 鏌ョ湅鏈嶅姟鐘舵€?```bash
docker-compose ps
```

#### 4. 鏌ョ湅鏃ュ織
```bash
docker-compose logs -f
```

---

## 璁块棶鍦板潃

| 鏈嶅姟 | 鍦板潃 | 璇存槑 |
|------|------|------|
| **鍓嶇** | http://localhost:8080 | Web 鐣岄潰 |
| **RTMP** | rtmp://localhost:1515/live | 鐩存挱娴?|
| **MySQL** | localhost:3306 | 鏁版嵁搴?|

---

## 榛樿璐﹀彿

| 瑙掕壊 | 鐢ㄦ埛鍚?| 瀵嗙爜 |
|------|--------|------|
| **绠＄悊鍛?* | admin | admin |
| **鏅€氱敤鎴?* | (娉ㄥ唽) | (娉ㄥ唽) |

---

## 閬囧埌闂锛?
### 闂 1: MySQL 杩炴帴澶辫触
```bash
# 妫€鏌?MySQL 瀹瑰櫒鐘舵€?docker-compose ps mysql
docker-compose logs mysql
```

### 闂 2: 鍚庣鍚姩澶辫触
```bash
# 鏌ョ湅鍚庣鏃ュ織
docker-compose logs backend
```

### 闂 3: 绔彛琚崰鐢?```bash
# 鏌ョ湅绔彛鍗犵敤
netstat -ano | findstr "8080 3306 1515"
```

淇敼 `docker-compose.yml` 涓殑绔彛鏄犲皠锛?
```yaml
ports:
  - "8081:80"  # 鏀规垚 8081
  - "1516:1935"  # 鏀规垚 1516
```

---

## 椤圭洰缁撴瀯

```
campus-surveillance-system/
鈹溾攢鈹€ docker-compose.yml     # 閮ㄧ讲閰嶇疆 鉁?宸蹭慨澶?鈹溾攢鈹€ init.sql              # 鏁版嵁搴撳垵濮嬪寲 鉁?宸蹭慨澶?鈹溾攢鈹€ backend/
鈹?  鈹溾攢鈹€ Dockerfile
鈹?  鈹溾攢鈹€ server.config.env
鈹?  鈹斺攢鈹€ src/
鈹?      鈹溾攢鈹€ app.module.ts    # 鍒濆鍖?鉁?宸蹭慨澶?鈹?      鈹斺攢鈹€ services/user/
鈹?          鈹斺攢鈹€ user.service.ts  # 鐧诲綍楠岃瘉 鉁?宸蹭慨澶?鈹溾攢鈹€ frontend/             # 鍓嶇 (鏋勫缓)
鈹溾攢鈹€ ai-end/               # AI 绔?(Python)
鈹斺攢鈹€ docs/                 # 鏂囨。
```

---

## 鎵嬪姩閮ㄧ讲锛堝垎姝ワ級

濡傛灉 `docker-compose up` 鏋勫缓澶辫触锛屽彲浠ュ垎姝ラ儴缃诧細

### 1. 鍚姩 MySQL
```bash
docker run -d \
  --name campus-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=campus-surveillance-system \
  -p 3306:3306 \
  -v ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro \
  mysql:8.0
```

### 2. 鍚姩鍚庣
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

### 3. 鍚姩鍓嶇+Nginx
```bash
docker build -f front-backend.Dockerfile -t campus-frontend .
docker run -d \
  --name campus-frontend \
  -p 8080:80 \
  -p 1515:1935 \
  campus-frontend
```

---

## AI 绔厤缃?
AI 绔渶瑕佹纭繛鎺ュ埌鍚庣锛?
```bash
docker run -d \
  --name campus-ai-end \
  -e HTTP_SERVER_URL=http://host.docker.internal:3000 \
  -e RTMP_SERVER_URL=rtmp://host.docker.internal:1515/live \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=admin \
  campus-ai-end
```

> 娉ㄦ剰: Windows 涓婁娇鐢?`host.docker.internal`锛孡inux 涓婁娇鐢?IP 鍦板潃

---

## 楠岃瘉閮ㄧ讲鎴愬姛

1. 璁块棶 http://localhost:8080
2. 浣跨敤 admin/admin 鐧诲綍
3. 妫€鏌ユ憚鍍忓ご绠＄悊椤甸潰

---

## 鑷畾涔変慨鏀?
### 淇敼绠＄悊鍛樺瘑鐮?```bash
# 杩涘叆鍚庣瀹瑰櫒
docker exec -it campus-backend sh

# 浣跨敤 Node.js 鍒涘缓瀵嗙爜鍝堝笇
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your-password', 10).then(p => console.log(p));"
```

鐒跺悗鍦ㄦ暟鎹簱涓洿鏂帮細
```sql
UPDATE users SET password = '鏂板搱甯屽€? WHERE username = 'admin';
```

### 淇敼 JWT Secret
鍦?`docker-compose.yml` 涓慨鏀癸細
```yaml
environment:
  JWT_SECRET: your-secret-key
```

---

## 鎶€鏈敮鎸?
濡傛湁闂锛岃妫€鏌ワ細
1. Docker Desktop 鏄惁杩愯
2. 绔彛 8080/3306/1515 鏄惁琚崰鐢?3. MySQL 瀹瑰櫒鏄惁鍋ュ悍鍚姩