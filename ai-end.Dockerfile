FROM continuumio/miniconda3:latest

ENV TZ=Asia/Shanghai
RUN echo $TZ > /etc/timezone && \
  ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
  dpkg-reconfigure -f noninteractive tzdata

# Replace sources.list with Aliyun mirror
RUN echo 'deb http://mirrors.aliyun.com/debian/ trixie main non-free-firmware' > /etc/apt/sources.list && \
    echo 'deb http://mirrors.aliyun.com/debian/ trixie-updates main non-free-firmware' >> /etc/apt/sources.list && \
    echo 'deb http://mirrors.aliyun.com/debian-security/ trixie-security main non-free-firmware' >> /etc/apt/sources.list

COPY ./ai-end /usr/share/campus-surveillance-system/ai-end

WORKDIR /usr/share/campus-surveillance-system/ai-end

# Install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg libsm6 libxext6 && \
  rm -rf /var/lib/apt/lists/*

# Install Python dependencies with pip (CPU-only PyTorch)
RUN pip install --no-cache-dir -r requirements.txt

CMD ["python3", "main.py"]