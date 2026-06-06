# syntax=docker/dockerfile:1
FROM python:3.10-slim

ARG TZ=Asia/Shanghai
ARG USE_CN_MIRROR=false
ARG PIP_INDEX_URL=https://pypi.org/simple/

ENV TZ=${TZ}
ENV PYTHONUNBUFFERED=1
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
    dpkg-reconfigure -f noninteractive tzdata

# Optionally use Aliyun mirror for faster apt in China
RUN if [ "$USE_CN_MIRROR" = "true" ]; then \
      echo 'deb http://mirrors.aliyun.com/debian/ bookworm main' > /etc/apt/sources.list && \
      echo 'deb http://mirrors.aliyun.com/debian/ bookworm-updates main' >> /etc/apt/sources.list && \
      echo 'deb http://mirrors.aliyun.com/debian-security/ bookworm-security main' >> /etc/apt/sources.list && \
      rm -f /etc/apt/sources.list.d/*.sources 2>/dev/null; \
    fi; true

# Install ffmpeg and dependencies
RUN apt-get update -o Acquire::Retries=3 -o Acquire::http::Timeout=10 && \
    apt-get install -y --no-install-recommends \
    ffmpeg libsm6 libxext6 libxrender1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY ./ai-end /usr/share/campus-surveillance-system/ai-end
WORKDIR /usr/share/campus-surveillance-system/ai-end

# Install Python dependencies (use --build-arg PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/ in China)
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --cache-dir=/root/.cache/pip -r requirements.txt \
    -i ${PIP_INDEX_URL} --timeout 120

CMD ["python3", "main.py"]