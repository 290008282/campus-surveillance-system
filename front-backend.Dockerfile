FROM node:20

ARG TZ=Asia/Shanghai
ARG USE_CN_MIRROR=false
ARG NPM_REGISTRY=https://registry.npmjs.org

ENV TZ=${TZ}
ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY}

RUN echo $TZ > /etc/timezone && \
    ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
    dpkg-reconfigure -f noninteractive tzdata

# Optionally use Aliyun mirror for faster apt in China
RUN if [ "$USE_CN_MIRROR" = "true" ]; then \
      echo 'deb http://mirrors.aliyun.com/debian/ bookworm main' > /etc/apt/sources.list && \
      echo 'deb http://mirrors.aliyun.com/debian/ bookworm-updates main' >> /etc/apt/sources.list && \
      echo 'deb http://mirrors.aliyun.com/debian-security/ bookworm-security main' >> /etc/apt/sources.list && \
      rm -f /etc/apt/sources.list.d/*.sources 2>/dev/null; \
    fi; true

# Install nginx + rtmp
RUN apt-get update -o Acquire::Retries=3 -o Acquire::http::Timeout=10 && \
    apt-get install -y --no-install-recommends nginx libnginx-mod-rtmp && \
    rm -rf /var/lib/apt/lists/*

# Remove ALL default nginx configs (prevent conflict)
RUN rm -f /etc/nginx/nginx.conf && \
    rm -f /etc/nginx/sites-enabled/* && \
    rm -f /etc/nginx/conf.d/*

# Build frontend
WORKDIR /build/frontend
COPY ./frontend ./
RUN npm install --legacy-peer-deps && \
    npm run build

# Verify frontend build output
RUN echo "=== Frontend build output ===" && \
    ls -la dist/ && \
    test -f dist/index.html && echo "dist/index.html exists" || (echo "dist/index.html MISSING" && exit 1)

# Install backend
WORKDIR /build/backend
COPY ./backend ./
RUN npm i -g pnpm && \
    pnpm i && \
    pnpm run build

# Now setup nginx and backend workdir
WORKDIR /usr/share/campus-surveillance-system/backend
RUN cp -r /build/backend/* . && \
    rm -rf /build/backend

# Copy frontend dist to nginx root (MUST match nginx.conf root directive)
RUN mkdir -p /usr/share/campus-surveillance-system/frontend/dist && \
    cp -r /build/frontend/dist/* /usr/share/campus-surveillance-system/frontend/dist/ && \
    rm -rf /build/frontend

# Copy nginx config AFTER removing defaults
COPY ./backend/nginx.conf /etc/nginx/nginx.conf

# Verify nginx config on build (fail fast if invalid)
RUN nginx -t

# Create required directories
RUN mkdir -p /var/log/nginx && \
    mkdir -p /dev/shm/nginx-live && \
    chown -R www-data:www-data /dev/shm/nginx-live

CMD sh -c "service nginx start && pnpm run start:prod"
