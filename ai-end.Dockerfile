# syntax=docker/dockerfile:1
FROM python:3.10-slim

ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
    dpkg-reconfigure -f noninteractive tzdata

# Use Aliyun mirror for bookworm (Debian 12)
RUN echo 'deb http://mirrors.aliyun.com/debian/ bookworm main' > /etc/apt/sources.list && \
    echo 'deb http://mirrors.aliyun.com/debian/ bookworm-updates main' >> /etc/apt/sources.list && \
    echo 'deb http://mirrors.aliyun.com/debian-security/ bookworm-security main' >> /etc/apt/sources.list && \
    rm -f /etc/apt/sources.list.d/*.sources 2>/dev/null; true

# Install ffmpeg and dependencies
RUN apt-get update -o Acquire::Retries=3 -o Acquire::http::Timeout=10 && \
    apt-get install -y --no-install-recommends \
    ffmpeg libsm6 libxext6 libxrender1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY ./ai-end /usr/share/campus-surveillance-system/ai-end
WORKDIR /usr/share/campus-surveillance-system/ai-end

# Use BuildKit cache mount to avoid re-downloading torch on every build
# DOCKER_BUILDKIT=1 or --platform support required; cache mounts persist across builds
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --cache-dir=/root/.cache/pip -r requirements.txt \
    -i https://mirrors.aliyun.com/pypi/simple/ --timeout 60

CMD ["python3", "main.py"]