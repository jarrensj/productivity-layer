export class DragToReorderUtil {
  private draggedElement: HTMLElement | null = null;
  private draggedIndex = -1;

  setupDragAndDrop<T>(
    container: HTMLElement,
    itemSelector: string,
    items: T[],
    onReorder: (fromIndex: number, toIndex: number) => void
  ) {
    container.querySelectorAll(itemSelector).forEach((item, index) => {
      const element = item as HTMLElement;

      element.addEventListener('dragstart', (e) => {
        this.draggedElement = element;
        this.draggedIndex = index;
        element.classList.add('dragging');

        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/html', element.outerHTML);
        }
      });

      element.addEventListener('dragend', () => {
        element.classList.remove('dragging');
        this.draggedElement = null;
        this.draggedIndex = -1;

        // Remove all drop indicators
        container.querySelectorAll(itemSelector).forEach(item => {
          item.classList.remove('drag-over-top', 'drag-over-bottom');
        });
      });

      element.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (this.draggedElement && this.draggedElement !== element) {
          const rect = element.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;

          // Remove previous indicators from all items
          container.querySelectorAll(itemSelector).forEach(item => {
            item.classList.remove('drag-over-top', 'drag-over-bottom');
          });

          const threshold = rect.height * 0.3;
          if (e.clientY < midY - threshold) {
            element.classList.add('drag-over-top');
          } else if (e.clientY > midY + threshold) {
            element.classList.add('drag-over-bottom');
          } else {
            if (e.clientY < midY) {
              element.classList.add('drag-over-top');
            } else {
              element.classList.add('drag-over-bottom');
            }
          }
        }
      });

      element.addEventListener('dragleave', (e) => {
        const rect = element.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || 
            e.clientY < rect.top || e.clientY > rect.bottom) {
          element.classList.remove('drag-over-top', 'drag-over-bottom');
        }
      });

      element.addEventListener('drop', (e) => {
        e.preventDefault();
        if (this.draggedElement && this.draggedElement !== element && this.draggedIndex !== -1) {
          const rect = element.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const dropIndex = index;
          let newIndex = dropIndex;

          const threshold = rect.height * 0.3;
          if (e.clientY < midY - threshold || (e.clientY < midY && e.clientY >= midY - threshold)) {
            newIndex = dropIndex;
          } else {
            newIndex = dropIndex + 1;
          }

          if (this.draggedIndex < newIndex) {
            newIndex--;
          }

          if (this.draggedIndex !== newIndex) {
            onReorder(this.draggedIndex, newIndex);
          }
        }

        // Clean up all indicators
        container.querySelectorAll(itemSelector).forEach(item => {
          item.classList.remove('drag-over-top', 'drag-over-bottom');
        });
      });
    });
  }
}
