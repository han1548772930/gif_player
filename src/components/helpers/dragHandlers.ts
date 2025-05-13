import { ref } from 'vue';
import type { TextItem } from './textManagement';

// 拖动状态对象
export const dragState = ref({
  isDragging: false,
  currentItem: null as TextItem | null,
  startX: 0,
  startY: 0,
  initialX: 0,
  initialY: 0
});

// 开始拖动
export const startDrag = (event: MouseEvent, item: TextItem) => {
  event.stopPropagation();
  event.preventDefault();
  
  dragState.value = {
    isDragging: true,
    currentItem: item,
    startX: event.clientX,
    startY: event.clientY,
    initialX: item.x,
    initialY: item.y
  };
  
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', endDrag);
};

// 处理拖动中的移动
export const handleDrag = (event: MouseEvent) => {
  if (dragState.value.isDragging && dragState.value.currentItem) {
    const dx = event.clientX - dragState.value.startX;
    const dy = event.clientY - dragState.value.startY;
    
    dragState.value.currentItem.x = dragState.value.initialX + dx;
    dragState.value.currentItem.y = dragState.value.initialY + dy;
  }
};

// 结束拖动
export const endDrag = () => {
  dragState.value.isDragging = false;
  dragState.value.currentItem = null;
  
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', endDrag);
};

// 触摸设备开始拖动
export const startTouchDrag = (event: TouchEvent, item: TextItem) => {
  if (event.touches.length === 1) {
    const touch = event.touches[0];
    
    dragState.value = {
      isDragging: true,
      currentItem: item,
      startX: touch.clientX,
      startY: touch.clientY,
      initialX: item.x,
      initialY: item.y
    };
    
    document.addEventListener('touchmove', handleTouchDrag, { passive: false });
    document.addEventListener('touchend', endTouchDrag);
  }
};

// 处理触摸拖动
export const handleTouchDrag = (event: TouchEvent) => {
  if (dragState.value.isDragging && dragState.value.currentItem && event.touches.length === 1) {
    event.preventDefault();
    
    const touch = event.touches[0];
    const dx = touch.clientX - dragState.value.startX;
    const dy = touch.clientY - dragState.value.startY;
    
    dragState.value.currentItem.x = dragState.value.initialX + dx;
    dragState.value.currentItem.y = dragState.value.initialY + dy;
  }
};

// 结束触摸拖动
export const endTouchDrag = () => {
  dragState.value.isDragging = false;
  dragState.value.currentItem = null;
  
  document.removeEventListener('touchmove', handleTouchDrag);
  document.removeEventListener('touchend', endTouchDrag);
};