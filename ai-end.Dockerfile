FROM python:3.10-slim

ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && \
    dpkg-reconfigure -f noninteractive tzdata

# Install ffmpeg and dependencies (libgl1-mesa-glx removed - not available in slim)
RUN apt-get update && apt-get install -y \
    ffmpeg libsm6 libxext6 libxrender1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY ./ai-end /usr/share/campus-surveillance-system/ai-end
WORKDIR /usr/share/campus-surveillance-system/ai-end

RUN pip install --no-cache-dir -r requirements.txt

CMD ["python3", "main.py"]