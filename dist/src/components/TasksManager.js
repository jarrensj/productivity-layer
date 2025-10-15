"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasksManager = void 0;
const utils_1 = require("../utils");
const DragToReorderUtil_1 = require("./DragToReorderUtil");
class TasksManager {
    items = [];
    itemsContainer;
    itemsCount;
    taskInput;
    dragUtil;
    editingTaskId = null;
    constructor() {
        this.itemsContainer = document.getElementById('tasks-items');
        this.itemsCount = document.getElementById('tasks-count');
        this.taskInput = document.getElementById('task-input');
        this.dragUtil = new DragToReorderUtil_1.DragToReorderUtil();
        this.init();
    }
    async init() {
        this.setupEventListeners();
        await this.loadSavedItems();
        this.setupGlobalEventListeners();
    }
    setupGlobalEventListeners() {
        document.addEventListener('clearAllTasks', async () => {
            this.items = [];
            this.saveToLocalStorage();
            this.renderItems();
        });
    }
    saveToLocalStorage() {
        utils_1.Utils.saveToLocalStorage('taskItems', this.items);
    }
    loadFromLocalStorage() {
        return utils_1.Utils.loadFromLocalStorage('taskItems');
    }
    setupEventListeners() {
        document.getElementById('add-task')?.addEventListener('click', async () => {
            const text = this.taskInput.value.trim();
            if (!text) {
                this.showMessage('Please enter a task', 'error');
                return;
            }
            await this.saveItem(text);
            this.taskInput.value = '';
        });
        this.taskInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const text = this.taskInput.value.trim();
                if (!text) {
                    this.showMessage('Please enter a task', 'error');
                    return;
                }
                await this.saveItem(text);
                this.taskInput.value = '';
            }
        });
    }
    async saveItem(text) {
        try {
            const result = await window.electronAPI.tasks.saveTask(text, this.items);
            this.items = result.items;
            this.saveToLocalStorage();
            this.renderItems();
            this.showMessage('Task added successfully', 'success');
        }
        catch (error) {
            console.error('Failed to save task:', error);
            this.showMessage('Failed to save task', 'error');
        }
    }
    async loadSavedItems() {
        try {
            const localItems = this.loadFromLocalStorage();
            if (localItems.length > 0) {
                this.items = localItems;
            }
            else {
                this.items = await window.electronAPI.tasks.getSavedTasks();
            }
            this.renderItems();
        }
        catch (error) {
            console.error('Failed to load tasks:', error);
        }
    }
    renderItems() {
        this.itemsCount.textContent = this.items.length.toString();
        if (this.items.length === 0) {
            this.itemsContainer.innerHTML = '<div class="no-items">No tasks yet</div>';
            return;
        }
        this.itemsContainer.innerHTML = this.items
            .map(item => this.renderItem(item))
            .join('');
        this.itemsContainer.querySelectorAll('.task-checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = checkbox.dataset.id;
                const task = this.items.find(i => i.id === id);
                if (task) {
                    await this.toggleTaskCompletion(task);
                }
            });
        });
        this.itemsContainer.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = e.target.dataset.id;
                if (this.editingTaskId && this.editingTaskId !== id) {
                    await this.cancelEdit();
                }
                this.startEdit(id);
            });
        });
        this.itemsContainer.querySelectorAll('.save-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = e.target.dataset.id;
                await this.saveEdit(id);
            });
        });
        this.itemsContainer.querySelectorAll('.cancel-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.cancelEdit();
            });
        });
        this.itemsContainer.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = e.target.dataset.id;
                this.items = await window.electronAPI.tasks.deleteTask(id, this.items);
                this.saveToLocalStorage();
                this.renderItems();
            });
        });
        this.itemsContainer.querySelectorAll('.task-edit-input').forEach(input => {
            input.addEventListener('keydown', async (e) => {
                const keyEvent = e;
                if (keyEvent.key === 'Enter') {
                    e.preventDefault();
                    const id = input.dataset.id;
                    await this.saveEdit(id);
                }
                else if (keyEvent.key === 'Escape') {
                    e.preventDefault();
                    await this.cancelEdit();
                }
            });
        });
        this.dragUtil.setupDragAndDrop(this.itemsContainer, '.task-item', this.items, (fromIndex, toIndex) => this.reorderItems(fromIndex, toIndex));
    }
    renderItem(item) {
        const timeAgo = utils_1.Utils.formatTimeAgo(item.timestamp);
        const isEditing = this.editingTaskId === item.id;
        return `
      <div class="task-item ${item.completed ? 'completed' : ''} ${isEditing ? 'editing' : ''}" data-id="${item.id}" draggable="true">
        <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
        <div class="task-checkbox ${item.completed ? 'checked' : ''}" data-id="${item.id}" title="${item.completed ? 'Mark incomplete' : 'Mark complete'}"></div>
        <div class="item-content">
          <div class="item-text" title="${utils_1.Utils.escapeHtml(item.text)}">${utils_1.Utils.escapeHtml(item.text)}</div>
          <input type="text" class="task-edit-input" data-id="${item.id}" value="${utils_1.Utils.escapeHtml(item.text)}" />
          <div class="item-meta">${timeAgo}</div>
        </div>
        <div class="task-actions">
          ${isEditing ? `
            <button class="save-btn edit-btn" data-id="${item.id}" title="Save changes">✓</button>
            <button class="cancel-btn edit-btn" data-id="${item.id}" title="Cancel editing">✕</button>
          ` : `
            <button class="edit-btn" data-id="${item.id}" title="Edit task">✎</button>
            <button class="delete-btn btn btn-small btn-danger" data-id="${item.id}" title="Delete task">×</button>
          `}
        </div>
      </div>
    `;
    }
    async toggleTaskCompletion(task) {
        try {
            const updates = { completed: !task.completed };
            this.items = await window.electronAPI.tasks.updateTask(task.id, updates, this.items);
            this.saveToLocalStorage();
            this.renderItems();
            this.showMessage(task.completed ? 'Task marked incomplete' : 'Task completed!', 'success');
        }
        catch (error) {
            console.error('Failed to update task:', error);
            this.showMessage('Failed to update task', 'error');
        }
    }
    startEdit(taskId) {
        this.editingTaskId = taskId;
        this.renderItems();
        const input = document.querySelector(`[data-id="${taskId}"].task-edit-input`);
        if (input) {
            input.focus();
            input.select();
        }
    }
    async saveEdit(taskId) {
        const input = document.querySelector(`[data-id="${taskId}"].task-edit-input`);
        if (!input)
            return;
        const newText = input.value.trim();
        if (!newText) {
            this.showMessage('Task cannot be empty', 'error');
            return;
        }
        try {
            const updates = { text: newText };
            this.items = await window.electronAPI.tasks.updateTask(taskId, updates, this.items);
            this.saveToLocalStorage();
            this.editingTaskId = null;
            this.renderItems();
            this.showMessage('Task updated successfully', 'success');
        }
        catch (error) {
            console.error('Failed to update task:', error);
            this.showMessage('Failed to update task', 'error');
        }
    }
    async cancelEdit() {
        this.editingTaskId = null;
        this.renderItems();
    }
    reorderItems(fromIndex, toIndex) {
        this.items = utils_1.Utils.reorderArray(this.items, fromIndex, toIndex);
        this.saveToLocalStorage();
        this.renderItems();
    }
    showMessage(message, type) {
        utils_1.Utils.showMessage(message, type);
    }
}
exports.TasksManager = TasksManager;
//# sourceMappingURL=TasksManager.js.map