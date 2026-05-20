FROM continuumio/miniconda3:latest

ENV TZ=Asia/Shanghai
RUN echo $TZ > /etc/timezone && \
  ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
  dpkg-reconfigure -f noninteractive tzdata

COPY ./ai-end /usr/share/campus-surveillance-system/ai-end

WORKDIR /usr/share/campus-surveillance-system/ai-end

# Install ffmpeg and system dependencies
RUN apt-get update && apt-get install -y ffmpeg libsm6 libxext6 && \
  rm -rf /var/lib/apt/lists/*

# Install Python dependencies with pip (CPU-only PyTorch)
RUN pip install --no-cache-dir -r requirements.txt

CMD ["python3", "main.py"]