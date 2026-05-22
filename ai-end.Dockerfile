FROM python:3.10-slim

ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
    dpkg-reconfigure -f noninteractive tzdata

# Use Aliyun mirror for faster downloads
RUN echo 'deb http://mirrors.aliyun.com/debian/ bullseye main' > /etc/apt/sources.list && \
    echo 'deb http://mirrors.aliyun.com/debian/ bullseye-updates main' >> /etc/apt/sources.list && \
    echo 'deb http://mirrors.aliyun.com/debian-security/ bullseye-security main' >> /etc/apt/sources.list

# Install ffmpeg and dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg libsm6 libxext6 libxrender1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY ./ai-end /usr/share/campus-surveillance-system/ai-end
WORKDIR /usr/share/campus-surveillance-system/ai-end

RUN pip install --no-cache-dir -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/

CMD ["python3", "main.py"]