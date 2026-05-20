FROM node:20-slim

ENV TZ=Asia/Shanghai
RUN echo $TZ > /etc/timezone && \
  ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
  dpkg-reconfigure -f noninteractive tzdata

# Install nginx + rtmp
RUN apt-get update && apt-get install -y nginx libnginx-mod-rtmp && \
  rm -f /etc/nginx/nginx.conf

# Build frontend
COPY ./frontend /usr/share/campus-surveillance-system/frontend
WORKDIR /usr/share/campus-surveillance-system/frontend
RUN npm install --legacy-peer-deps && npm run build

# Install backend
COPY ./backend /usr/share/campus-surveillance-system/backend
WORKDIR /usr/share/campus-surveillance-system/backend
RUN npm i -g pnpm && pnpm i

COPY ./backend/nginx.conf /etc/nginx/nginx.conf

CMD service nginx start && pnpm run start:prod