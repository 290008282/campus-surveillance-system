FROM node:lts-buster-slim

ENV TZ=Asia/Shanghai
RUN echo $TZ > /etc/timezone && \
  ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
  dpkg-reconfigure -f noninteractive tzdata

# 瀹夎 nginx + rtmp
RUN apt-get update && apt-get install -y nginx libnginx-mod-rtmp && \
  rm -f /etc/nginx/nginx.conf

# 鏋勫缓鍓嶇
COPY ./frontend /usr/share/campus-surveillance-system/frontend
WORKDIR /usr/share/campus-surveillance-system/frontend
RUN npm install --legacy-peer-deps && npm run build

# 瀹夎鍚庣
COPY ./backend /usr/share/campus-surveillance-system/backend
WORKDIR /usr/share/campus-surveillance-system/backend
RUN npm i -g pnpm && pnpm i

COPY ./backend/nginx.conf /etc/nginx/nginx.conf

CMD service nginx start && pnpm run start:prod