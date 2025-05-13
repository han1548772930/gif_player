import { toBlobURL } from '@ffmpeg/util';
import type { FFmpeg, LogEvent } from '@ffmpeg/ffmpeg';
import type { Ref } from 'vue';
import type { TextItem } from './textManagement';

export interface DragState {
  isDragging: boolean;
  currentItem: TextItem | null;
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
}

export interface Context {
  // FFmpeg 实例
  ffmpeg: FFmpeg;

  // GIF 数据相关
  frames: Ref<string[]>;
  currentFrameIndex: Ref<number>;
  totalFrames: Ref<number>;
  gifUrl: Ref<string>;

  // 文本相关
  textItems: Ref<TextItem[]>;
  nextTextId: Ref<number>;

  // 状态控制
  isLoading: Ref<boolean>;
  loaded: Ref<boolean>;
  isPlaying: Ref<boolean>;

  // UI 和消息
  message: Ref<string>;

  // 播放控制
  playbackSpeed: Ref<number>;
  playInterval: number | null;

  // 拖拽状态
  dragState: Ref<DragState>;

  // 可选的调试模式 (用于文本边框显示等调试功能)
  debugMode?: boolean;
}

// 初始化 FFmpeg
export const initFFmpeg = async (context: Context) => {
  const { ffmpeg } = context;

  // 新版本FFmpeg需要指定core和wasm文件路径
  const baseURL = '/ffmpeg'

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