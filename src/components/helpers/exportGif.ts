import { cleanupAfterExport } from '@/components/helpers/cleanupUtils';

// 导出带文字的 GIF 函数
export const exportGifWithText = async (context: any) => {
  const { frames, textItems, ffmpeg, isLoading } = context;

  if (frames.value.length === 0) return;
  isLoading.value = true;

  try {
    // 计算坐标转换参数
    const frameDisplay = document.querySelector('.frame-display');
    if (!frameDisplay) return;
    const displayedImg = frameDisplay?.querySelector('img');

    // 计算偏移量和缩放比例
    let offsetX = 0;
    let offsetY = 0;
    let scaleX = 1;
    let scaleY = 1;

    if (displayedImg) {
      const imgRect = displayedImg.getBoundingClientRect();
      const containerRect = frameDisplay.getBoundingClientRect();

      // 计算图像在容器中的偏移量
      offsetX = (containerRect.width - imgRect.width) / 2;
      offsetY = (containerRect.height - imgRect.height) / 2;
    }

    // 处理每一帧
    for (let i = 0; i < frames.value.length; i++) {
      // 获取原始帧
      const response = await fetch(frames.value[i]);
      const blob = await response.blob();

      // 获取适用于当前帧的所有文本项
      const frameTextItems = textItems.value.filter((item: { frameRange: string; frameIndex: number; endFrameIndex: any; }) => {
        if (item.frameRange === 'single') {
          return item.frameIndex === i;
        } else if (item.frameRange === 'all') {
          return true;
        } else if (item.frameRange === 'multiple') {
          return i >= item.frameIndex && i <= (item.endFrameIndex || item.frameIndex);
        }
        return false;
      });

      // 处理该帧
      if (frameTextItems.length > 0) {
        await processFrameWithText(context, i, blob, frameTextItems, displayedImg, offsetX, offsetY);
      } else {
        // 如果没有文字，直接保存原始帧
        const buffer = await blob.arrayBuffer();
        const frameFile = `frame_${i.toString().padStart(4, '0')}.png`;
        await ffmpeg.writeFile(frameFile, new Uint8Array(buffer));
      }
    }

    // 生成GIF
    await ffmpeg.exec([
      '-framerate', '10',
      '-i', 'frame_%04d.png',
      '-threads', '4',
      '-y',
      'output.gif'
    ]);

    // 下载生成的 GIF
    await downloadGif(context);

    // 清理
    await cleanupAfterExport(context);

  } catch (error) {
    console.error('导出GIF时出错:', error);
    isLoading.value = false;
    alert('导出GIF时出错: ' + ((error as Error).message || '未知错误'));
  }
};

// 处理带文本的帧
async function processFrameWithText(
  context: any,
  index: number,
  blob: Blob,
  frameTextItems: any[],
  displayedImg: Element | null | undefined,
  offsetX: number,
  offsetY: number
) {
  const { ffmpeg } = context;

  const img = new Image();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 等待图像加载
  await new Promise((resolve) => {
    img.onload = resolve;
    img.src = URL.createObjectURL(blob);
  });

  // 设置canvas尺寸
  canvas.width = img.width;
  canvas.height = img.height;

  // 绘制原始图像
  ctx.drawImage(img, 0, 0);

  // 重新计算每一帧的缩放比例
  let scaleX = 1;
  let scaleY = 1;

  if (displayedImg) {
    const displayWidth = displayedImg.getBoundingClientRect().width;
    const displayHeight = displayedImg.getBoundingClientRect().height;

    // 实际缩放比例
    scaleX = img.width / displayWidth;
    scaleY = img.height / displayHeight;
  }

  // 添加文本
  frameTextItems.forEach((item: any) => {
    ctx.fillStyle = item.color;

    // 设置字体大小
    const fontSize = Math.round(item.size * scaleX);
    ctx.font = `${fontSize}px Arial`;

    // 计算调整后的坐标
    const adjustedX = (item.x - offsetX) * scaleX;

    // 修改Y坐标计算，考虑文本基线偏移
    const textBaselineOffset = fontSize * 0.75;
    const adjustedY = (item.y - offsetY) * scaleY + textBaselineOffset;

    ctx.fillText(item.content, adjustedX, adjustedY);
  });

  // 将Canvas转换为Blob
  const modifiedBlob = await new Promise<Blob>(resolve => {
    canvas.toBlob(blob => resolve(blob!), 'image/png');
  });

  // 保存修改后的帧
  const buffer = await modifiedBlob.arrayBuffer();
  const frameFile = `frame_${index.toString().padStart(4, '0')}.png`;
  await ffmpeg.writeFile(frameFile, new Uint8Array(buffer));

  // 清理
  URL.revokeObjectURL(img.src);
}

// 下载生成的GIF
async function downloadGif(context: any) {
  const { ffmpeg, isLoading } = context;

  try {
    const data = await ffmpeg.readFile('output.gif');

    // 处理不同数据类型
    let blobData;
    if (data instanceof Uint8Array) {
      blobData = data;
    } else if (typeof data === 'string') {
      try {
        const base64Content = data.split(',')[1] || data;
        blobData = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));
      } catch (e) {
        console.error('Base64解码失败:', e);
        const encoder = new TextEncoder();
        blobData = encoder.encode(data);
      }
    } else {
      console.error('未知的数据类型:', typeof data);
      throw new Error('无法处理未知类型的数据');
    }

    // 创建Blob对象并下载
    const blob = new Blob([blobData], { type: 'image/gif' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = 'edited.gif';
    a.click();

    // 清理
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      isLoading.value = false;
    }, 100);
  } catch (error) {
    console.error('下载GIF时出错:', error);
    throw error;
  }
}