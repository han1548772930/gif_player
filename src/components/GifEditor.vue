<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { FFmpeg } from '@ffmpeg/ffmpeg';


// 导入抽离的功能模块
import { initFFmpeg, type Context } from '@/components/helpers/ffmpeg';
import {
  addTextItem, removeTextItem, type TextItem,
  getCurrentFrameTextItems  // 修改导入名称
} from '@/components/helpers/textManagement';
import {
  startDrag, handleDrag, endDrag,
  startTouchDrag, handleTouchDrag, endTouchDrag, dragState
} from '@/components/helpers/dragHandlers';
import { exportGifWithText } from '@/components/helpers/exportGif';
import { handleFileUpload } from '@/components/helpers/fileHandlers';
import { cleanup } from './helpers/cleanupUtils';


// 共享状态变量
const gifUrl = ref<string>('');
const frames = ref<string[]>([]);
const currentFrameIndex = ref(0);
const totalFrames = ref(0);
const isPlaying = ref(false);
const playbackSpeed = ref(100);
const isLoading = ref(false);
const ffmpeg = new FFmpeg();
const loaded = ref(false);
const message = ref('');
const textItems = ref<TextItem[]>([]);
const nextTextId = ref(1);
const showOnlyCurrentFrameTexts = ref(false);
const currentFrameTextItems = computed(() => getCurrentFrameTextItems(context));

const startFrameIndex = ref(0);
const endFrameIndex = ref(0);
// 添加用于当前帧指示器的拖动状态
const indicatorDragState = ref({
  isDragging: false,
  startX: 0,
  sliderWidth: 0
});

// 计算开始和结束帧的百分比位置
const startFramePercentage = computed(() => {
  if (totalFrames.value === 0) return 0;
  return (startFrameIndex.value / (totalFrames.value - 1)) * 100;
});

const endFramePercentage = computed(() => {
  if (totalFrames.value === 0) return 100;
  return (endFrameIndex.value / (totalFrames.value - 1)) * 100;
});


// 计算属性
const progressPercentage = computed(() => {
  if (totalFrames.value === 0) return 0;
  return (currentFrameIndex.value / (totalFrames.value - 1)) * 100;
});

// 播放/暂停控制
let playInterval: number | null = null;
const togglePlay = () => {
  isPlaying.value = !isPlaying.value;

  if (isPlaying.value) {
    playInterval = window.setInterval(() => {
      if (currentFrameIndex.value < totalFrames.value - 1) {
        currentFrameIndex.value++;
      } else {
        currentFrameIndex.value = 0;
      }
    }, playbackSpeed.value);
  } else if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
};

// 前进后退控制
const nextFrame = () => {
  if (currentFrameIndex.value < totalFrames.value - 1) {
    currentFrameIndex.value++;
  }
};

const prevFrame = () => {
  if (currentFrameIndex.value > 0) {
    currentFrameIndex.value--;
  }
};




// 裁剪GIF功能
const trimGif = () => {
  // 只保留选定范围内的帧
  const trimmedFrames = frames.value.slice(startFrameIndex.value, endFrameIndex.value + 1);

  // 确保至少有一帧
  if (trimmedFrames.length > 0) {
    // 更新帧数据
    frames.value = trimmedFrames;
    totalFrames.value = trimmedFrames.length;

    // 重置索引
    currentFrameIndex.value = 0;
    startFrameIndex.value = 0;
    endFrameIndex.value = trimmedFrames.length - 1;
  }
};


const handleFileUploadWrapped = async (e: Event, ctx: Context) => {
  await handleFileUpload(e, ctx);
  // 文件加载完成后，设置结束帧为最后一帧
  endFrameIndex.value = totalFrames.value - 1;
};




// 为各功能模块提供上下文
const context: Context = {
  ffmpeg,
  frames,
  currentFrameIndex,
  totalFrames,
  textItems,
  nextTextId,
  gifUrl,
  isLoading,
  loaded,
  message,
  playbackSpeed,
  playInterval,
  dragState,
  isPlaying,
  startFrameIndex,
  endFrameIndex,
};


const isTextApplicableToCurrentFrame = (item: TextItem) => {
  if (item.frameRange === 'single') {
    return item.frameIndex === currentFrameIndex.value;
  } else if (item.frameRange === 'all') {
    return true;
  } else if (item.frameRange === 'multiple') {
    return currentFrameIndex.value >= item.frameIndex &&
      currentFrameIndex.value <= (item.endFrameIndex || item.frameIndex);
  }
  return false;
};

// 将范围设置为当前帧
const setRangeToCurrentFrame = (item: TextItem) => {
  item.frameIndex = currentFrameIndex.value;
  item.endFrameIndex = currentFrameIndex.value;
};

// 初始化
onMounted(async () => {
  // 初始添加一个文本项
  // if (textItems.value.length === 0) {
  //   addTextItem(context, 'single');
  // }

  // 初始化 FFmpeg
  try {
    isLoading.value = true;
    await initFFmpeg(context);
    loaded.value = true;
    isLoading.value = false;
  } catch (error) {

    isLoading.value = false;
  }
});
const sliderDragState = ref({
  isDragging: false,
  handleType: null as 'start' | 'end' | null,
  startX: 0,
  sliderWidth: 0
});

// 开始拖动滑块
const startDragHandle = (event: MouseEvent, handleType: 'start' | 'end') => {
  event.preventDefault();

  const sliderEl = document.querySelector('.custom-range-slider') as HTMLElement;
  if (!sliderEl) return;

  const sliderRect = sliderEl.getBoundingClientRect();

  sliderDragState.value = {
    isDragging: true,
    handleType,
    startX: event.clientX,
    sliderWidth: sliderRect.width
  };

  // 添加事件监听
  document.addEventListener('mousemove', handleDragHandle);
  document.addEventListener('mouseup', endDragHandle);
};

// 开始触摸拖动滑块
const startTouchDragHandle = (event: TouchEvent, handleType: 'start' | 'end') => {
  event.preventDefault();

  const sliderEl = document.querySelector('.custom-range-slider') as HTMLElement;
  if (!sliderEl || !event.touches[0]) return;

  const sliderRect = sliderEl.getBoundingClientRect();

  sliderDragState.value = {
    isDragging: true,
    handleType,
    startX: event.touches[0].clientX,
    sliderWidth: sliderRect.width
  };

  // 添加事件监听
  document.addEventListener('touchmove', handleTouchDragHandle);
  document.addEventListener('touchend', endDragHandle);
};

// 处理滑块拖动
const handleDragHandle = (event: MouseEvent) => {
  if (!sliderDragState.value.isDragging) return;

  const sliderEl = document.querySelector('.custom-range-slider') as HTMLElement;
  if (!sliderEl) return;

  const sliderRect = sliderEl.getBoundingClientRect();
  const relativeX = event.clientX - sliderRect.left;
  const percentage = Math.max(0, Math.min(100, (relativeX / sliderRect.width) * 100));

  updateHandlePosition(percentage);
};

// 处理触摸滑块拖动
const handleTouchDragHandle = (event: TouchEvent) => {
  if (!sliderDragState.value.isDragging || !event.touches[0]) return;
  event.preventDefault();

  const sliderEl = document.querySelector('.custom-range-slider') as HTMLElement;
  if (!sliderEl) return;

  const sliderRect = sliderEl.getBoundingClientRect();
  const relativeX = event.touches[0].clientX - sliderRect.left;
  const percentage = Math.max(0, Math.min(100, (relativeX / sliderRect.width) * 100));

  updateHandlePosition(percentage);
};

// 更新滑块位置
const updateHandlePosition = (percentage: number) => {
  const frameIndex = Math.floor((percentage / 100) * (totalFrames.value - 1));

  if (sliderDragState.value.handleType === 'start') {
    // 确保开始帧不超过结束帧
    startFrameIndex.value = Math.min(frameIndex, endFrameIndex.value - 1);

    // 如果当前帧小于开始帧，将当前帧设为开始帧
    if (currentFrameIndex.value < startFrameIndex.value) {
      currentFrameIndex.value = startFrameIndex.value;
    }
  } else if (sliderDragState.value.handleType === 'end') {
    // 确保结束帧不小于开始帧
    endFrameIndex.value = Math.max(frameIndex, startFrameIndex.value + 1);

    // 如果当前帧大于结束帧，将当前帧设为结束帧
    if (currentFrameIndex.value > endFrameIndex.value) {
      currentFrameIndex.value = endFrameIndex.value;
    }
  }
};

// 结束拖动
const endDragHandle = () => {
  sliderDragState.value.isDragging = false;
  sliderDragState.value.handleType = null;

  document.removeEventListener('mousemove', handleDragHandle);
  document.removeEventListener('mouseup', endDragHandle);
  document.removeEventListener('touchmove', handleTouchDragHandle);
  document.removeEventListener('touchend', endDragHandle);
};

// 处理进度条点击
const handleTrackClick = (event: MouseEvent) => {
  const sliderEl = document.querySelector('.custom-range-slider') as HTMLElement;
  if (!sliderEl) return;

  const sliderRect = sliderEl.getBoundingClientRect();
  const relativeX = event.clientX - sliderRect.left;
  const percentage = (relativeX / sliderRect.width) * 100;
  const frameIndex = Math.floor((percentage / 100) * (totalFrames.value - 1));

  // 设置当前帧
  currentFrameIndex.value = Math.max(
    startFrameIndex.value,
    Math.min(frameIndex, endFrameIndex.value)
  );
};
// 开始拖动当前帧指示器
const startIndicatorDrag = (event: MouseEvent) => {
  event.preventDefault();

  const sliderEl = document.querySelector('.custom-range-slider') as HTMLElement;
  if (!sliderEl) return;

  const sliderRect = sliderEl.getBoundingClientRect();

  indicatorDragState.value = {
    isDragging: true,
    startX: event.clientX,
    sliderWidth: sliderRect.width
  };

  // 添加事件监听
  document.addEventListener('mousemove', handleIndicatorDrag);
  document.addEventListener('mouseup', endIndicatorDrag);
};

// 开始触摸拖动当前帧指示器
const startIndicatorTouchDrag = (event: TouchEvent) => {
  event.preventDefault();

  const sliderEl = document.querySelector('.custom-range-slider') as HTMLElement;
  if (!sliderEl || !event.touches[0]) return;

  const sliderRect = sliderEl.getBoundingClientRect();

  indicatorDragState.value = {
    isDragging: true,
    startX: event.touches[0].clientX,
    sliderWidth: sliderRect.width
  };

  // 添加事件监听
  document.addEventListener('touchmove', handleIndicatorTouchDrag);
  document.addEventListener('touchend', endIndicatorDrag);
};

// 处理指示器拖动
const handleIndicatorDrag = (event: MouseEvent) => {
  if (!indicatorDragState.value.isDragging) return;

  const sliderEl = document.querySelector('.custom-range-slider') as HTMLElement;
  if (!sliderEl) return;

  const sliderRect = sliderEl.getBoundingClientRect();
  const relativeX = event.clientX - sliderRect.left;
  const percentage = Math.max(0, Math.min(100, (relativeX / sliderRect.width) * 100));

  updateIndicatorPosition(percentage);
};

// 处理触摸指示器拖动
const handleIndicatorTouchDrag = (event: TouchEvent) => {
  if (!indicatorDragState.value.isDragging || !event.touches[0]) return;
  event.preventDefault();

  const sliderEl = document.querySelector('.custom-range-slider') as HTMLElement;
  if (!sliderEl) return;

  const sliderRect = sliderEl.getBoundingClientRect();
  const relativeX = event.touches[0].clientX - sliderRect.left;
  const percentage = Math.max(0, Math.min(100, (relativeX / sliderRect.width) * 100));

  updateIndicatorPosition(percentage);
};

// 更新指示器位置和当前帧
const updateIndicatorPosition = (percentage: number) => {
  const frameIndex = Math.floor((percentage / 100) * (totalFrames.value - 1));

  // 确保当前帧在裁剪范围内
  currentFrameIndex.value = Math.max(
    startFrameIndex.value,
    Math.min(frameIndex, endFrameIndex.value)
  );
};

// 结束指示器拖动
const endIndicatorDrag = () => {
  indicatorDragState.value.isDragging = false;

  document.removeEventListener('mousemove', handleIndicatorDrag);
  document.removeEventListener('mouseup', endIndicatorDrag);
  document.removeEventListener('touchmove', handleIndicatorTouchDrag);
  document.removeEventListener('touchend', endIndicatorDrag);
};
// 清理事件监听
onBeforeUnmount(() => {
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', endDrag);
  document.removeEventListener('touchmove', handleTouchDrag);
  document.removeEventListener('touchend', endTouchDrag);
  document.removeEventListener('mousemove', handleDragHandle);
  document.removeEventListener('mouseup', endDragHandle);
  document.removeEventListener('touchmove', handleTouchDragHandle);
  document.removeEventListener('touchend', endDragHandle);
  document.removeEventListener('mousemove', handleIndicatorDrag);
  document.removeEventListener('mouseup', endIndicatorDrag);
  document.removeEventListener('touchmove', handleIndicatorTouchDrag);
  document.removeEventListener('touchend', endIndicatorDrag);
  cleanup(context);
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
  ffmpeg.terminate();
});
</script>

<template>
  <div class="flex flex-col md:flex-row gap-5 w-full h-screen p-2.5 box-border">

    <!-- 左侧 GIF 显示区域 -->
    <div class="flex-1 min-w-[300px] md:max-w-[60%] w-full">
      <div class="flex justify-start gap-5 items-center">
        <h1>GIF 编辑器</h1>

        <a href="https://github.com/han1548772930/gif_player" target="_blank"
          class="text-black flex justify-center items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            class="cursor-pointer">
            <path
              d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
            <path d="M9 18c-4.51 2-5-2-7-2" />
          </svg>
        </a>
      </div>

      <div class="bg-gray-100 p-2 rounded text-gray-700 text-sm mb-4 break-words">
        FFMPEG Log:{{ message }}
      </div>

      <div class="mb-5 flex flex-col gap-1">
        <input type="file" accept="image/gif" @change="(e) => handleFileUploadWrapped(e, context)"
          :disabled="!loaded || frames.length > 0"
          class="file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-green-600 file:text-white hover:file:bg-green-700 file:cursor-pointer disabled:opacity-50" />
        <p v-if="!loaded" class="text-gray-500 italic mt-1">加载 FFmpeg 中，请稍等...</p>
      </div>

      <div v-if="isLoading" class="flex justify-center items-center h-[200px] text-lg bg-gray-100 rounded w-full">
        加载中...
      </div>

      <div v-if="frames.length > 0" class="w-full">
        <div class="relative my-2 border border-gray-300 overflow-hidden max-w-full bg-black text-center">
          <img :src="frames[currentFrameIndex]" alt="当前帧"
            class="max-w-full max-h-[60vh] md:max-h-[50vh] inline-block object-contain" />

          <!-- 文本覆盖层 -->
          <div v-for="item in currentFrameTextItems" :key="item.id"
            class="absolute pointer-events-auto whitespace-pre-wrap shadow-text cursor-move select-none transition-transform duration-50 ease-in"
            :class="{ 'opacity-80 scale-102 outline outline-white/70': dragState.isDragging && dragState.currentItem?.id === item.id }"
            :style="{
              left: `${item.x}px`,
              top: `${item.y}px`,
              fontSize: `${item.size}px`,
              color: item.color
            }" @mousedown="(e) => startDrag(e, item)" @touchstart="(e) => startTouchDrag(e, item)" :data-id="item.id">
            {{ item.content }}
          </div>
        </div>

        <div class="flex items-center flex-wrap gap-1 ">
          <button @click="prevFrame" :disabled="currentFrameIndex <= 0" class="px-4 py-2 bg-green-600 text-white border-none rounded cursor-pointer whitespace-nowrap 
                         hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed">上一帧</button>
          <button @click="togglePlay"
            class="px-4 py-2 bg-green-600 text-white border-none rounded cursor-pointer whitespace-nowrap hover:bg-green-700">
            {{ isPlaying ? '暂停' : '播放' }}
          </button>
          <button @click="nextFrame" :disabled="currentFrameIndex >= totalFrames - 1" class="px-4 py-2 bg-green-600 text-white border-none rounded cursor-pointer whitespace-nowrap 
                         hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed">下一帧</button>
          <span class="ml-auto sm:ml-0 sm:w-full sm:text-center">帧 {{ currentFrameIndex + 1 }} / {{ totalFrames
          }}</span>
        </div>

        <!-- 自定义范围滑块 -->
        <div class="w-full">
          <div class="relative w-full h-[30px] my-2 select-none custom-range-slider">
            <!-- 进度条背景 -->
            <div class="absolute w-full h-1.5 bg-gray-200 rounded-sm top-3 slider-track"></div>

            <!-- 选中区域 -->
            <div
              class="absolute h-1.5 bg-green-600 top-3 rounded-sm shadow-sm transition-colors duration-200 hover:bg-green-700 slider-selection"
              :style="{
                left: startFramePercentage + '%',
                width: (endFramePercentage - startFramePercentage) + '%'
              }">
            </div>

            <!-- 当前帧指示器 -->
            <div
              class="absolute transform -translate-x-1/2 z-30 text-red-500 bottom-[-15px] pointer-events-auto cursor-grab active:cursor-grabbing current-frame-indicator"
              :style="{ left: progressPercentage + '%' }" @mousedown="startIndicatorDrag"
              @touchstart="startIndicatorTouchDrag">
              <!-- 增加透明点击区域 -->
              <div class="absolute inset-0 -m-2"></div>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                class="hover:text-red-700 active:text-red-800 relative">
                <path d="m18 9-6-6-6 6" />
                <path d="M12 3v14" />
                <path d="M5 21h14" />
              </svg>
            </div>

            <!-- 左侧滑块(开始帧) -->
            <div
              class="absolute w-4.5 h-4.5 bg-blue-500 border-2 border-white rounded-full shadow cursor-pointer top-1.5 
          -translate-x-1/2 z-20 transition-all hover:scale-110 hover:shadow-md active:scale-115 active:shadow-lg slider-handle start-handle"
              :style="{ left: startFramePercentage + '%' }" @mousedown="startDragHandle($event, 'start')"
              @touchstart="startTouchDragHandle($event, 'start')">
              <div
                class="absolute top-[-25px] left-1/2 -translate-x-1/2 bg-gray-800 text-white py-0.5 px-1.5 rounded text-xs 
                        whitespace-nowrap opacity-0 transition-opacity pointer-events-none group-hover:opacity-100 handle-tooltip">
                {{ startFrameIndex + 1 }}
              </div>
            </div>

            <!-- 右侧滑块(结束帧) -->
            <div
              class="absolute w-4.5 h-4.5 bg-orange-500 border-2 border-white rounded-full shadow cursor-pointer top-1.5 
                      -translate-x-1/2 z-20 transition-all hover:scale-110 hover:shadow-md active:scale-115 active:shadow-lg slider-handle end-handle"
              :style="{ left: endFramePercentage + '%' }" @mousedown="startDragHandle($event, 'end')"
              @touchstart="startTouchDragHandle($event, 'end')">
              <div
                class="absolute top-[-25px] left-1/2 -translate-x-1/2 bg-gray-800 text-white py-0.5 px-1.5 rounded text-xs 
                        whitespace-nowrap opacity-0 transition-opacity pointer-events-none group-hover:opacity-100 handle-tooltip">
                {{ endFrameIndex + 1 }}
              </div>
            </div>

            <!-- 可点击的进度条区域 -->
            <div class="absolute w-full h-5 top-1.5 cursor-pointer z-0 slider-clickable-track"
              @click="handleTrackClick">
            </div>
          </div>
        </div>

        <div class="flex justify-between items-center  text-sm">
          <span class="select-none">裁剪范围: 帧 {{ startFrameIndex + 1 }} - {{ endFrameIndex + 1 }}</span>
          <button
            class="bg-gradient-to-b from-orange-600 to-orange-700 text-white transition-all duration-200 rounded px-3.5 py-1.5 
                       shadow-sm cursor-pointer hover:from-orange-700 hover:to-orange-800 hover:-translate-y-0.5 hover:shadow-md
                       active:translate-y-0 active:shadow-sm disabled:bg-gray-300 disabled:transform-none disabled:shadow-none"
            @click="trimGif" :disabled="frames.length === 0">裁剪帧</button>
        </div>

        <div class="flex items-center flex-wrap gap-1  sm:flex-col sm:items-start">
          <label>播放速度: </label>
          <input type="range" min="50" max="500" v-model="playbackSpeed" step="10" class="w-auto sm:w-full" />
          <span>{{ playbackSpeed }}ms</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-2.5 bg-blue-50 rounded text-sm">
          <div class="bg-white rounded p-1.5 text-center shadow-sm">当前编辑帧: {{ currentFrameIndex + 1 }} / {{ totalFrames
          }}</div>
          <div class="bg-white rounded p-1.5 text-center shadow-sm">当前帧文本数: {{ currentFrameTextItems.length }}</div>
          <div class="bg-white rounded p-1.5 text-center shadow-sm">所有帧文本总数: {{ textItems.length }}</div>
        </div>

        <h3 class="text-lg font-medium  mb-1">添加文字到帧(裁剪帧之后再添加文字)</h3>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-1 mb-2">
          <button @click="() => addTextItem(context, 'single')"
            class="px-4 py-2 bg-green-600 text-white border-none rounded cursor-pointer hover:bg-green-700">
            添加文本到当前帧
          </button>
          <button @click="() => addTextItem(context, 'multiple')"
            class="px-4 py-2 bg-orange-500 text-white border-none rounded cursor-pointer hover:bg-orange-600">
            添加文本到帧范围
          </button>
          <button @click="() => addTextItem(context, 'all')"
            class="px-4 py-2 bg-purple-600 text-white border-none rounded cursor-pointer hover:bg-purple-700">
            添加文本到所有帧
          </button>
        </div>

        <div class="mb-2">
          <button @click="showOnlyCurrentFrameTexts = !showOnlyCurrentFrameTexts"
            class="w-full px-4 py-2 bg-blue-500 text-white border-none rounded cursor-pointer hover:bg-blue-600"
            :class="{ 'ring-2 ring-blue-900': showOnlyCurrentFrameTexts }">
            {{ showOnlyCurrentFrameTexts ? '显示所有文本项' : '只显示当前帧文本' }}
          </button>
        </div>

        <!-- 当前帧的文本项列表 -->
        <!-- <div v-if="currentFrameTextItems.length === 0" class="text-center p-4 bg-gray-100 rounded text-gray-600 italic">
          当前帧没有文本项，点击上方按钮添加
        </div> -->

        <div class="flex justify-center gap-5 mt-2">
          <button @click="() => exportGifWithText(context)"
            class="px-5 py-2.5 bg-green-600 text-white border-none rounded cursor-pointer hover:bg-green-700">
            导出编辑后的 GIF
          </button>
          <button @click="() => cleanup(context)"
            class="px-5 py-2.5 bg-red-600 text-white border-none rounded cursor-pointer hover:bg-red-700">
            清除GIF
          </button>
        </div>
      </div>
    </div>

    <!-- 右侧文本编辑区域 -->
    <div v-if="frames.length > 0" class="flex-1 min-w-[300px] max-h-screen overflow-y-auto w-full">
      <div class="w-full">
        <div class="sticky top-0 bg-gray-50 p-3 shadow-sm z-10 rounded mb-1">
          <h4 class="font-medium mb-0">所有文本项 <span class="text-xs text-gray-500 italic">(当前帧标记为绿色)(文字均可拖动)</span></h4>
        </div>

        <div v-if="textItems.length === 0" class="text-center p-4 bg-gray-100 rounded text-gray-600 italic mt-3">
          没有文本项，点击上方按钮添加
        </div>

        <div v-for="item in textItems" :key="item.id" class="border border-gray-200 rounded p-2.5 mb-2 bg-gray-50"
          :class="{ 'border-l-4 border-l-green-500': isTextApplicableToCurrentFrame(item) }">

          <div class="flex justify-between items-center mb-2.5 pb-1.5 border-b border-gray-200">
            <span>
              文本 #{{ item.id }}
              <span class="inline-block px-1.5 py-0.5 rounded-full text-xs text-white ml-2" :class="{
                'bg-green-500': item.frameRange === 'single',
                'bg-orange-500': item.frameRange === 'multiple',
                'bg-purple-600': item.frameRange === 'all'
              }">
                {{
                  item.frameRange === 'single' ? `帧 ${item.frameIndex + 1}` :
                    item.frameRange === 'multiple' ? `帧${item.frameIndex + 1}至${(item.endFrameIndex || item.frameIndex) +
                      1}`
                      :
                      '所有帧'
                }}
              </span>
            </span>
            <button @click="() => removeTextItem(context, item.id)"
              class="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600">
              删除
            </button>
          </div>

          <!-- 文本内容编辑区 -->
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center mb-2.5">
            <label class="w-24">文字内容:</label>
            <input type="text" v-model="item.content" placeholder="输入要添加的文字"
              class="px-2 py-1.5 border border-gray-300 rounded flex-1" />
          </div>

          <div class="flex flex-col gap-2 sm:flex-row sm:items-center mb-2.5">
            <label class="w-24">应用范围:</label>
            <select v-model="item.frameRange" class="px-2 py-1.5 border border-gray-300 rounded">
              <option value="single">单帧</option>
              <option value="multiple">帧范围</option>
              <option value="all">所有帧</option>
            </select>
          </div>

          <!-- 单帧选择 -->
          <div v-if="item.frameRange === 'single'" class="flex flex-wrap gap-2 items-center mb-2.5">
            <label class="w-24">帧编号:</label>
            <input type="number" :value="item.frameIndex + 1"
              @input="(e: Event) => item.frameIndex = Math.max(0, Math.min(parseInt((e.target as HTMLInputElement).value) - 1, totalFrames - 1))"
              min="1" :max="totalFrames" class="px-2 py-1 border border-gray-300 rounded w-20" />
            <button @click="item.frameIndex = currentFrameIndex"
              class="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700">使用当前帧</button>
          </div>

          <!-- 帧范围选择 -->
          <div v-if="item.frameRange === 'multiple'" class="flex flex-wrap gap-2 items-center mb-2.5">
            <label class="w-24">起始帧:</label>
            <input type="number" :value="item.frameIndex + 1"
              @input="e => item.frameIndex = Math.max(0, Math.min(parseInt((e.target as HTMLInputElement).value) - 1, totalFrames - 1))"
              min="1" :max="totalFrames" class="px-2 py-1 border border-gray-300 rounded w-20" />

            <label class="w-24">结束帧:</label>
            <input type="number" :value="(item.endFrameIndex || item.frameIndex) + 1"
              @input="e => item.endFrameIndex = Math.max(item.frameIndex, Math.min(parseInt((e.target as HTMLInputElement).value) - 1, totalFrames - 1))"
              :min="item.frameIndex + 1" :max="totalFrames" class="px-2 py-1 border border-gray-300 rounded w-20" />

            <button @click="setRangeToCurrentFrame(item)"
              class="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700">使用当前帧</button>
          </div>

          <!-- 其他属性 -->
          <div class="grid grid-cols-2 gap-2 mb-2.5">
            <div class="flex items-center gap-2">
              <label class="w-16">位置 X:</label>
              <input type="number" v-model.number="item.x" class="px-2 py-1 border border-gray-300 rounded flex-1" />
            </div>
            <div class="flex items-center gap-2">
              <label class="w-16">位置 Y:</label>
              <input type="number" v-model.number="item.y" class="px-2 py-1 border border-gray-300 rounded flex-1" />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="flex items-center gap-2">
              <label class="w-16">大小:</label>
              <input type="number" v-model.number="item.size" class="px-2 py-1 border border-gray-300 rounded flex-1" />
            </div>
            <div class="flex items-center gap-2">
              <label class="w-16">颜色:</label>
              <input type="color" v-model="item.color" class="w-10 h-10 rounded cursor-pointer" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 少量必要的自定义样式 */
.shadow-text {
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}

.slider-handle:hover .handle-tooltip {
  opacity: 1;
}



/* 滑块的特殊缩放值 */
.scale-102 {
  transform: scale(1.02);
}

.scale-115 {
  transform: scale(1.15);
}

/* 特定尺寸调整 */
.w-4\.5 {
  width: 1.125rem;
}

.h-4\.5 {
  height: 1.125rem;
}
</style>