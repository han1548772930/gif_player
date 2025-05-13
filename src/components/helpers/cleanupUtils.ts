import type { Context } from "./ffmpeg";

// 添加一个专门用于导出后清理的函数，不需要确认
export const cleanupAfterExport = async (context: Context) => {
  const { ffmpeg, totalFrames } = context;

  // 清理FFmpeg中的临时文件，但保留原始帧和状态
  try {
    for (let i = 0; i < totalFrames.value; i++) {
      try {
        // 只清理修改后的帧
        await ffmpeg.deleteFile(`frame_${i.toString().padStart(4, '0')}.png`);
      } catch (e) {
        // 忽略不存在的文件
      }
    }

    // 清理输出文件
    try {
      await ffmpeg.deleteFile('output.gif');
    } catch (e) {
      // 忽略
    }
  } catch (e) {
    console.log('清理临时文件时出错，但不影响使用');
  }
};

// 全面清理资源函数
export const cleanup = async (context: Context) => {
  const { frames, gifUrl, ffmpeg, totalFrames, currentFrameIndex, isPlaying, playInterval } = context;

  // 清理播放定时器
  if (playInterval) {
    clearInterval(playInterval);
    context.playInterval = null;
  }

  // 清理所有帧的URL资源
  frames.value.forEach((url: string) => URL.revokeObjectURL(url));
  frames.value = [];

  // 清理原始GIF URL
  if (gifUrl.value) {
    URL.revokeObjectURL(gifUrl.value);
    gifUrl.value = '';
  }

  // 清理FFmpeg中的临时文件
  try {
    for (let i = 1; i <= totalFrames.value; i++) {
      try {
        // 清理原始帧
        await ffmpeg.deleteFile(`frame${i}.png`);
      } catch (e) {
        // 忽略不存在的文件
      }
    }

    for (let i = 0; i < totalFrames.value; i++) {
      try {
        // 清理修改后的帧
        await ffmpeg.deleteFile(`frame_${i.toString().padStart(4, '0')}.png`);
      } catch (e) {
        // 忽略不存在的文件
      }
    }

    // 清理输出文件
    try {
      await ffmpeg.deleteFile('output.gif');
    } catch (e) {
      // 忽略
    }

    // 清理输入文件
    try {
      await ffmpeg.deleteFile('input.gif');
    } catch (e) {
      // 忽略
    }
  } catch (e) {
    console.log('清理FFmpeg文件时出错，但不影响使用');
  }

  // 重置状态
  currentFrameIndex.value = 0;
  totalFrames.value = 0;
  isPlaying.value = false;
};