FROM python:3.10-slim

ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
    dpkg-reconfigure -f noninteractive tzdata

# Force Aliyun mirror and disable slow sources
RUN echo 'deb http://mirrors.aliyun.com/debian/ bullseye main' > /etc/apt/sources.list && \
    echo 'deb http://mirrors.aliyun.com/debian/ bullseye-updates main' >> /etc/apt/sources.list && \
    echo 'deb http://mirrors.aliyun.com/debian-security/ bullseye-security main' >> /etc/apt/sources.list && \
    rm -f /etc/apt/sources.list.d/*.sources 2>/dev/null; true

# Install ffmpeg and dependencies (with timeout to avoid hanging)
RUN apt-get update -o Acquire::Retries=3 -o Acquire::http::Timeout=10 && \
    apt-get install -y --no-install-recommends \
    ffmpeg libsm6 libxext6 libxrender1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY ./ai-end /usr/share/campus-surveillance-system/ai-end
WORKDIR /usr/share/campus-surveillance-system/ai-end

RUN pip install --no-cache-dir -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/ --timeout 60

CMD ["python3", "main.py"]