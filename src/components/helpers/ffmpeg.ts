import { toBlobURL } from '@ffmpeg/util';
import type { LogEvent } from '@ffmpeg/ffmpeg';

// 初始化 FFmpeg
export const initFFmpeg = async (context: any) => {
  const { ffmpeg } = context;
  
  // 新版本FFmpeg需要指定core和wasm文件路径
  const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.10/dist/esm'
  
  ffmpeg.on('log', ({ message: msg }: LogEvent) => {
    context.message.value = msg;
    console.log(context.message.value);
  });

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript')
  });
};