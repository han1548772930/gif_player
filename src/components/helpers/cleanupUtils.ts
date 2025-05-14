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
        console.log(`删除帧 ${i} 时出错，可能是文件不存在`);

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
// 列出根目录下的所有文件
async function listFFmpegFiles(context: Context) {
  const { ffmpeg } = context;

  try {
    // 列出根目录中的所有文件
    const files = await ffmpeg.listDir('/');
    console.log('FFmpeg 虚拟文件系统中的文件:', files);
    return files;
  } catch (error) {
    console.error('列出 FFmpeg 文件失败:', error);
    return [];
  }
}

// 全面清理资源函数 - 删除 return 语句，使函数正常执行
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

  try {
    // 首先列出所有文件
    const files = await listFFmpegFiles(context);
    console.log('准备清理以下文件:', files);

    // 清理所有非目录文件
    for (const file of files) {
      // 只处理文件，跳过目录
      if (file.isDir === false) {
        try {
          await ffmpeg.deleteFile(file.name);
          console.log(`已成功清理文件: ${file.name}`);
        } catch (e) {
          console.log(`清理文件 ${file.name} 失败，但继续处理`);
        }
      }
    }
  } catch (e) {
    console.log('获取或清理文件列表时出错，尝试使用传统方法清理', e);

    // 如果列出文件失败，回退到传统的清理方法
    try {
      // 清理原始帧文件
      for (let i = 1; i <= totalFrames.value; i++) {
        try {
          await ffmpeg.deleteFile(`frame${i}.png`);
        } catch (e) {
          // 忽略单个文件删除失败
        }
      }

      // 清理修改后的帧文件
      for (let i = 0; i < totalFrames.value; i++) {
        try {
          await ffmpeg.deleteFile(`frame_${i.toString().padStart(4, '0')}.png`);
        } catch (e) {
          // 忽略单个文件删除失败
        }
      }

      // 清理常见的临时文件
      const commonFiles = ['input.gif', 'output.gif', 'stats.txt'];
      for (const fileName of commonFiles) {
        try {
          await ffmpeg.deleteFile(fileName);
        } catch (e) {
          // 忽略不存在的文件
        }
      }
    } catch (cleanupError) {
      console.log('传统清理方法也失败，但不影响继续使用', cleanupError);
    }
  }

  // 重置状态
  currentFrameIndex.value = 0;
  totalFrames.value = 0;
  isPlaying.value = false;

  // 重置文件输入框
  try {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';  // 清除选择的文件
    }
  } catch (e) {
    console.log('重置文件输入框失败，但不影响使用');
  }

  console.log('清理完成，所有资源都已释放');

  // 清理后检查剩余文件
  // try {
  //   const remainingFiles = await listFFmpegFiles(context);
  //   console.log('清理后剩余的文件:', remainingFiles);
  // } catch (e) {
  //   console.log('清理后无法检查剩余文件');
  // }
};