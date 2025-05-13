import { fetchFile } from '@ffmpeg/util';

// 处理文件上传
export const handleFileUpload = async (e: Event, context: any) => {
  const { ffmpeg, frames, currentFrameIndex, totalFrames, gifUrl, isLoading } = context;
  
  const target = e.target as HTMLInputElement;
  if (!target.files || !target.files[0]) return;

  const file = target.files[0];
  if (!file.type.includes('gif')) {
    alert('请上传 GIF 文件');
    return;
  }

  isLoading.value = true;

  try {
    // 创建 URL 用于显示原始 GIF
    gifUrl.value = URL.createObjectURL(file);

    try {
      // 使用 FFmpeg 提取帧
      await ffmpeg.writeFile('input.gif', await fetchFile(file));
      await ffmpeg.exec(['-i', 'input.gif', '-threads', '4', '-vsync', '0', 'frame%d.png']);

      // 获取所有帧
      frames.value = [];
      let frameIndex = 1;

      while (true) {
        try {
          // 读取帧
          const frameData = await ffmpeg.readFile(`frame${frameIndex}.png`);

          // 转换数据
          let blobData;
          if (frameData instanceof Uint8Array) {
            blobData = frameData;
          } else if (typeof frameData === 'string') {
            const base64 = frameData.split(',')[1];
            blobData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
          } else {
            blobData = new Uint8Array(frameData);
          }

          const url = URL.createObjectURL(new Blob([blobData], { type: 'image/png' }));
          frames.value.push(url);
          frameIndex++;
        } catch (error) {
          break;
        }
      }

      totalFrames.value = frames.value.length;
      currentFrameIndex.value = 0;

      // 检查是否成功提取帧
      if (frames.value.length === 0) {
        alert('无法从 GIF 中提取帧');
      }
    } catch (ffmpegError: any) {
      alert(`FFmpeg处理失败: ${ffmpegError.message || '未知错误'}`);
    }

    isLoading.value = false;
  } catch (error: any) {
    isLoading.value = false;
    alert('处理 GIF 时发生错误: ' + (error.message || '未知错误'));
  }
};