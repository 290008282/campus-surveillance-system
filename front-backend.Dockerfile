FROM node:18

ENV TZ=Asia/Shanghai
RUN echo $TZ > /etc/timezone && \
  ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
  dpkg-reconfigure -f noninteractive tzdata

# Use Aliyun mirror for apt (bookworm)
RUN echo 'deb http://mirrors.aliyun.com/debian/ bookworm main' > /etc/apt/sources.list && \
    echo 'deb http://mirrors.aliyun.com/debian/ bookworm-updates main' >> /etc/apt/sources.list && \
    echo 'deb http://mirrors.aliyun.com/debian-security/ bookworm-security main' >> /etc/apt/sources.list && \
    rm -f /etc/apt/sources.list.d/*.sources 2>/dev/null; true

# Install nginx + rtmp
RUN apt-get update -o Acquire::Retries=3 -o Acquire::http::Timeout=10 && \
    apt-get install -y --no-install-recommends nginx libnginx-mod-rtmp && \
    rm -f /etc/nginx/nginx.conf

# Build frontend
COPY ./frontend /usr/share/campus-surveillance-system/frontend
WORKDIR /usr/share/campus-surveillance-system/frontend
RUN npm install --legacy-peer-deps && npm run build

# Install backend
COPY ./backend /usr/share/campus-surveillance-system/backend
WORKDIR /usr/share/campus-surveillance-system/backend
RUN npm i -g pnpm && pnpm i && pnpm run build

COPY ./backend/nginx.conf /etc/nginx/nginx.conf

CMD service nginx start && pnpm run start:prod