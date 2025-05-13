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

// 进度条控制
const handleProgressChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const progress = parseInt(target.value, 10);
  currentFrameIndex.value = Math.floor((progress / 100) * (totalFrames.value - 1));
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
  isPlaying
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
  if (textItems.value.length === 0) {
    addTextItem(context, 'single');
  }

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

// 清理事件监听
onBeforeUnmount(() => {
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', endDrag);
  document.removeEventListener('touchmove', handleTouchDrag);
  document.removeEventListener('touchend', endTouchDrag);
  cleanup(context);
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
});
</script>

<template>
  <div class="gif-editor">
    <!-- {{ context.frames.value.length }} -->
    <!-- 左侧 GIF 显示区域 -->
    <div class="editor-left-panel">
      <h1>GIF 编辑器</h1>
      <div class="message">FFMPEG Log:{{ message }}</div>

      <div class="upload-section">
        <input type="file" accept="image/gif" @change="(e) => handleFileUpload(e, context)" :disabled="!loaded" />
        <p v-if="!loaded" class="loading-hint">加载 FFmpeg 中，请稍等...</p>
      </div>

      <div v-if="isLoading" class="loading">
        加载中...
      </div>

      <div v-if="frames.length > 0" class="editor-main">
        <div class="frame-display">
          <img :src="frames[currentFrameIndex]" alt="当前帧" />

          <!-- 仅显示当前帧的文本项 -->
          <div v-for="item in currentFrameTextItems" :key="item.id" class="text-overlay draggable" :style="{
            left: `${item.x}px`,
            top: `${item.y}px`,
            fontSize: `${item.size}px`,
            color: item.color
          }" @mousedown="(e) => startDrag(e, item)" @touchstart="(e) => startTouchDrag(e, item)" :data-id="item.id">
            {{ item.content }}
          </div>
        </div>

        <div class="controls">
          <button @click="prevFrame" :disabled="currentFrameIndex <= 0">上一帧</button>
          <button @click="togglePlay">{{ isPlaying ? '暂停' : '播放' }}</button>
          <button @click="nextFrame" :disabled="currentFrameIndex >= totalFrames - 1">下一帧</button>
          <span class="frame-info">帧 {{ currentFrameIndex + 1 }} / {{ totalFrames }}</span>
        </div>

        <div class="progress-bar">
          <input type="range" min="0" max="100" :value="progressPercentage" @input="handleProgressChange" />
        </div>

        <div class="speed-control">
          <label>播放速度: </label>
          <input type="range" min="50" max="500" v-model="playbackSpeed" step="10" />
          <span>{{ playbackSpeed }}ms</span>
        </div>

        <div class="frame-info-panel">
          <div class="frame-counter">当前编辑帧: {{ currentFrameIndex + 1 }} / {{ totalFrames }}</div>
          <div class="text-counter">当前帧文本数: {{ currentFrameTextItems.length }}</div>
          <div class="total-text-counter">所有帧文本总数: {{ textItems.length }}</div>
        </div>
        <h3>添加文字到帧</h3>

        <div class="add-text-options">
          <button class="add-text-btn" @click="() => addTextItem(context, 'single')">添加文本到当前帧</button>
          <button class="add-text-btn add-range-btn" @click="() => addTextItem(context, 'multiple')">添加文本到帧范围</button>
          <button class="add-text-btn add-all-btn" @click="() => addTextItem(context, 'all')">添加文本到所有帧</button>
        </div>

        <div class="filter-options">
          <button :class="['filter-btn', { active: showOnlyCurrentFrameTexts }]"
            @click="showOnlyCurrentFrameTexts = !showOnlyCurrentFrameTexts">
            {{ showOnlyCurrentFrameTexts ? '显示所有文本项' : '只显示当前帧文本' }}
          </button>
        </div>

        <!-- 当前帧的文本项列表 -->
        <div v-if="currentFrameTextItems.length === 0" class="no-text-message">
          当前帧没有文本项，点击上方按钮添加
        </div>
        <div class="export-section">
          <button @click="() => exportGifWithText(context)">导出编辑后的 GIF</button>
        </div>
      </div>
    </div>

    <!-- 右侧文本编辑区域 -->
    <div v-if="frames.length > 0" class="editor-right-panel">
      <div class="text-control">


        <div class="text-items-list">
          <div class="small-hint">
            <h4>所有文本项 <span>(当前帧标记为绿色)</span></h4>
          </div>

          <div v-if="textItems.length === 0" class="no-text-message">
            没有文本项，点击上方按钮添加
          </div>

          <div v-for="item in textItems" :key="item.id" class="text-item"
            :class="{ 'active-frame-text': isTextApplicableToCurrentFrame(item) }">
            <div class="text-item-header">
              <span>
                文本 #{{ item.id }}
                <span class="text-range-badge" :class="{
                  'range-single': item.frameRange === 'single',
                  'range-multiple': item.frameRange === 'multiple',
                  'range-all': item.frameRange === 'all'
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
              <button class="remove-btn" @click="() => removeTextItem(context, item.id)">删除</button>
            </div>

            <!-- 文本内容编辑区 -->
            <div>
              <label>文字内容:</label>
              <input type="text" v-model="item.content" placeholder="输入要添加的文字" />
            </div>

            <div>
              <label>应用范围:</label>
              <select v-model="item.frameRange">
                <option value="single">单帧</option>
                <option value="multiple">帧范围</option>
                <option value="all">所有帧</option>
              </select>
            </div>

            <!-- 单帧选择 -->
            <div v-if="item.frameRange === 'single'">
              <label>帧编号:</label>
              <input type="number" :value="item.frameIndex + 1"
                @input="(e: Event) => item.frameIndex = Math.max(0, Math.min(parseInt((e.target as HTMLInputElement).value) - 1, totalFrames - 1))"
                min="1" :max="totalFrames" />
              <button class="small-btn" @click="item.frameIndex = currentFrameIndex">使用当前帧</button>
            </div>

            <!-- 帧范围选择 -->
            <div v-if="item.frameRange === 'multiple'">
              <label>起始帧:</label>
              <input type="number" :value="item.frameIndex + 1"
                @input="e => item.frameIndex = Math.max(0, Math.min(parseInt((e.target as HTMLInputElement).value) - 1, totalFrames - 1))"
                min="1" :max="totalFrames" />

              <label>结束帧:</label>
              <input type="number" :value="(item.endFrameIndex || item.frameIndex) + 1"
                @input="e => item.endFrameIndex = Math.max(item.frameIndex, Math.min(parseInt((e.target as HTMLInputElement).value) - 1, totalFrames - 1))"
                :min="item.frameIndex + 1" :max="totalFrames" />

              <button class="small-btn" @click="setRangeToCurrentFrame(item)">使用当前帧</button>
            </div>

            <!-- 其他属性不变 -->
            <div>
              <label>位置 X:</label>
              <input type="number" v-model.number="item.x" />
              <label>位置 Y:</label>
              <input type="number" v-model.number="item.y" />
            </div>

            <div>
              <label>大小:</label>
              <input type="number" v-model.number="item.size" />
              <label>颜色:</label>
              <input type="color" v-model="item.color" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gif-editor {
  width: 100%;
  display: flex;
  flex-direction: row;
  gap: 20px;
  height: 100vh;
  padding: 10px;
  box-sizing: border-box;
}

.editor-left-panel {
  flex: 1;
  min-width: 300px;
  max-width: 60%;
}

.editor-right-panel {
  flex: 1;
  min-width: 300px;
  max-height: 100vh;
  overflow-y: auto;
}

.editor-main {
  width: 100%;
}

.message {
  background-color: #f0f0f0;
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 15px;
  color: #333;
  font-size: 14px;
  word-break: break-word;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  font-size: 18px;
  background-color: #f5f5f5;
  border-radius: 4px;
  width: 100%;
}

.loading-hint {
  color: #666;
  font-style: italic;
  margin-top: 5px;
}

.frame-display {
  position: relative;
  margin: 20px 0;
  border: 1px solid #ccc;
  overflow: hidden;
  max-width: 100%;
  background-color: #000;
  text-align: center;
}

.frame-display img {
  max-width: 100%;
  max-height: 60vh;
  display: inline-block;
  object-fit: contain;
}

.text-overlay {
  position: absolute;
  pointer-events: auto;
  white-space: pre-wrap;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  max-width: 80%;
  overflow: hidden;
  cursor: move;
  user-select: none;
  transition: transform 0.05s ease;
}

.text-overlay:hover {
  outline: 1px dashed rgba(255, 255, 255, 0.5);
}

.text-overlay.dragging {
  opacity: 0.8;
  transform: scale(1.02);
  outline: 2px solid rgba(255, 255, 255, 0.7);
}

.controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 10px 0;
}

.frame-info {
  margin-left: auto;
}

.progress-bar {
  margin: 10px 0;
  width: 100%;
}

.progress-bar input {
  width: 100%;
}

.speed-control {
  margin: 10px 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  width: 100%;
}

.text-control {
  margin: 0;
  border-radius: 4px;
  width: 100%;
}

.text-control div {
  margin: 10px 0;
  display: flex;
  align-items: center;
  justify-content: start;
  flex-wrap: wrap;
  gap: 10px;
}

.text-control h3 {
  margin-top: 0;
  margin-bottom: 15px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.export-section {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}

button:hover {
  background-color: #45a049;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

input[type="text"],
input[type="number"] {
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-width: 0;
  flex: 1;
  max-width: 100%;
}

.upload-section {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.text-item {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 15px;
  background-color: #f9f9f9;
  width: 100%;
  box-sizing: border-box;
}

.text-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 5px;
  border-bottom: 1px solid #eee;
}

.remove-btn {
  background-color: #f44336;
  padding: 4px 8px;
  font-size: 12px;
}

.remove-btn:hover {
  background-color: #d32f2f;
}

.add-text-btn {
  flex: 1;
  min-width: 150px;
}

.add-range-btn {
  background-color: #FF9800;
}

.add-range-btn:hover {
  background-color: #F57C00;
}

.add-text-btn:hover {
  background-color: #0b7dda;
}

.add-all-btn {
  background-color: #9C27B0;
}

.add-all-btn:hover {
  background-color: #7B1FA2;
}

.add-text-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 15px;
}

.text-range-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 12px;
  margin-left: 8px;
}

.range-single {
  background-color: #4CAF50;
  color: white;
}

.range-multiple {
  background-color: #FF9800;
  color: white;
}

.range-all {
  background-color: #9C27B0;
  color: white;
}

.no-text-message {
  text-align: center;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 4px;
  color: #666;
  font-style: italic;
}

.frame-info-panel {
  margin: 15px 0;
  padding: 10px;
  background: #eef6ff;
  border-radius: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  width: 100%;
  box-sizing: border-box;
}

.active-frame-text {
  border-left: 4px solid #4CAF50;
}

.small-hint {
  position: sticky;
  top: 0;
  background-color: #f8f8f8;
  width: 100%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.small-hint span {
  font-size: 12px;
  color: #666;
  font-style: italic;
}

.small-btn {
  padding: 2px 6px;
  font-size: 12px;
  background-color: #607D8B;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.small-btn:hover {
  background-color: #455A64;
}

.frame-counter,
.text-counter,
.total-text-counter {
  padding: 5px 10px;
  background: white;
  border-radius: 4px;
  font-size: 0.9em;
  flex: 1;
  text-align: center;
  min-width: 120px;
}

.text-items-list {
  max-height: 100vh;
  height: 100%;
  position: relative;
}

.filter-btn {
  background-color: #2196F3;
  width: 100%;
}

.filter-btn:hover,
.filter-btn.active {
  background-color: #0b7dda;
}

.filter-btn.active {
  border: 2px solid #003366;
}

/* 添加响应式布局 */
@media screen and (max-width: 900px) {
  .gif-editor {
    flex-direction: column;
  }

  .editor-left-panel,
  .editor-right-panel {
    max-width: 100%;
    width: 100%;
  }

  .frame-display img {
    max-height: 50vh;
  }
}

@media screen and (max-width: 768px) {
  .gif-editor {
    padding: 5px;
  }

  .text-item div {
    flex-direction: column;
    align-items: flex-start;
  }

  .text-item div input {
    width: 100%;
  }

  .controls {
    justify-content: center;
  }

  .frame-info {
    margin: 10px 0 0 0;
    width: 100%;
    text-align: center;
  }

  .speed-control {
    flex-direction: column;
    align-items: flex-start;
  }

  .speed-control input {
    width: 100%;
  }
}
</style>