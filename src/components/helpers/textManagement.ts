
import { computed } from 'vue';

// 文本项接口定义
export interface TextItem {
  id: number;
  frameIndex: number;
  frameRange: 'single' | 'multiple' | 'all';
  endFrameIndex?: number;
  content: string;
  x: number;
  y: number;
  size: number;
  color: string;
}

// 添加新文本项方法
export const addTextItem = (context: any, range: 'single' | 'multiple' | 'all' = 'single') => {
  const { textItems, nextTextId, currentFrameIndex } = context;

  const newItem: TextItem = {
    id: nextTextId.value++,
    frameIndex: currentFrameIndex.value, // 仍然默认从当前帧开始
    frameRange: range,
    content: '新文本',
    x: 10,
    y: 10,  // 固定初始位置
    size: 24,
    color: '#ffffff'
  };

  if (range === 'multiple') {
    // 默认结束帧与起始帧相同
    newItem.endFrameIndex = currentFrameIndex.value;
  }

  textItems.value.push(newItem);
  return newItem; // 返回新创建的项目，便于后续操作
};

// 删除文本项方法
export const removeTextItem = (context: any, id: number) => {
  const { textItems } = context;
  const index = textItems.value.findIndex((item: { id: number; }) => item.id === id);
  if (index !== -1) {
    textItems.value.splice(index, 1);
  }
};

// 计算当前帧的文本项
export const getCurrentFrameTextItems = (context: any): TextItem[] => {
  const { textItems, currentFrameIndex } = context;

  return textItems.value.filter((item: TextItem) => {
    if (item.frameRange === 'single') {
      return item.frameIndex === currentFrameIndex.value;
    } else if (item.frameRange === 'all') {
      return true;
    } else if (item.frameRange === 'multiple') {
      return currentFrameIndex.value >= item.frameIndex &&
        currentFrameIndex.value <= (item.endFrameIndex || item.frameIndex);
    }
    return false;
  });
};