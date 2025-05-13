import { cleanupAfterExport } from '@/components/helpers/cleanupUtils';
import type { Context } from './ffmpeg';
import type { TextItem } from './textManagement';

// 导出带文字的 GIF 函数
export const exportGifWithText = async (context: Context) => {
  const { frames, textItems, ffmpeg } = context;

  if (frames.value.length === 0) return;

  try {
    // 计算坐标转换参数
    const frameDisplay = document.querySelector('.frame-display');
    if (!frameDisplay) return;
    const displayedImg = frameDisplay?.querySelector('img');

    // 计算偏移量和缩放比例
    let offsetX = 0;
    let offsetY = 0;
    // let scaleX = 1;
    // let scaleY = 1;

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
      const frameTextItems = textItems.value.filter((item: TextItem) => {
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

    // alert('导出GIF时出错: ' + ((error as Error).message || '未知错误'));
  }
};

// 处理带文本的帧
async function processFrameWithText(
  context: Context,
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

    // 获取文本尺寸
    const metrics = ctx.measureText(item.content);

    // 使用高精度计算真实文本高度和位置
    const textHeight = Math.max(
      metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
      fontSize * 1.2 // 备用估算值，防止浏览器未实现精确测量
    );

    // 完全重新计算x和y坐标，不依赖于偏移量的修正
    // 计算显示坐标到实际图像坐标的映射
    const actualX = (item.x - offsetX) * scaleX;




    const actualY = (item.y - offsetY) * scaleY + textHeight;


    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.strokeText(item.content, actualX, actualY);
    ctx.fillText(item.content, actualX, actualY);
    // 绘制文本边框用于调试
    // if (context.debugMode) {
    //   ctx.strokeStyle = 'red';
    //   ctx.lineWidth = 2;
    //   ctx.strokeRect(
    //     actualX,
    //     actualY - textHeight * 0.8, // 近似文本顶部位置
    //     metrics.width,
    //     textHeight
    //   );
    // }
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
async function downloadGif(context: Context) {
  const { ffmpeg } = context;

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

    }, 100);
  } catch (error) {
    console.error('下载GIF时出错:', error);
    throw error;
  }
}