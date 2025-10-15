"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImagesManager = void 0;
const utils_1 = require("../utils");
class ImagesManager {
    currentImageData = null;
    uploadArea;
    fileInput;
    uploadPlaceholder;
    currentImageContainer;
    currentImageElement;
    imagePrompt;
    generateButton;
    imageResults;
    changeImageButton;
    clearImageButton;
    constructor() {
        this.uploadArea = document.getElementById('image-upload-area');
        this.fileInput = document.getElementById('image-file-input');
        this.uploadPlaceholder = document.querySelector('.upload-placeholder');
        this.currentImageContainer = document.getElementById('current-image-container');
        this.currentImageElement = document.getElementById('current-image');
        this.imagePrompt = document.getElementById('image-prompt');
        this.generateButton = document.getElementById('generate-image');
        this.imageResults = document.getElementById('image-results');
        this.changeImageButton = document.getElementById('change-image');
        this.clearImageButton = document.getElementById('clear-image');
        this.init();
    }
    init() {
        this.setupEventListeners();
        this.setupGlobalEventListeners();
        this.loadSavedImage();
    }
    setupGlobalEventListeners() {
        document.addEventListener('clearAllImages', () => {
            this.clearImage();
        });
    }
    setupEventListeners() {
        this.uploadArea.addEventListener('click', (e) => {
            if (e.target === this.uploadArea || e.target === this.uploadPlaceholder ||
                this.uploadPlaceholder.contains(e.target)) {
                this.fileInput.click();
            }
        });
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) {
                this.handleImageUpload(file);
            }
        });
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });
        this.uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
        });
        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                const file = files[0];
                if (file.type.startsWith('image/')) {
                    this.handleImageUpload(file);
                }
                else {
                    this.showMessage('Please upload an image file', 'error');
                }
            }
        });
        this.changeImageButton.addEventListener('click', () => {
            this.fileInput.click();
        });
        this.clearImageButton.addEventListener('click', () => {
            this.clearImage();
        });
        this.generateButton.addEventListener('click', () => {
            this.generateImage();
        });
        this.imagePrompt.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                this.generateImage();
            }
        });
    }
    handleImageUpload(file) {
        if (!file.type.startsWith('image/')) {
            this.showMessage('Please select a valid image file', 'error');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            this.showMessage('Image file is too large. Please select a file under 10MB', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result;
            this.currentImageData = dataUrl;
            this.displayCurrentImage(dataUrl);
            this.saveImageToLocalStorage();
            this.showMessage('Image uploaded successfully', 'success');
        };
        reader.onerror = () => {
            this.showMessage('Failed to read image file', 'error');
        };
        reader.readAsDataURL(file);
    }
    displayCurrentImage(dataUrl) {
        this.currentImageElement.src = dataUrl;
        this.uploadPlaceholder.style.display = 'none';
        this.currentImageContainer.style.display = 'flex';
    }
    clearImage() {
        this.currentImageData = null;
        this.currentImageElement.src = '';
        this.uploadPlaceholder.style.display = 'flex';
        this.currentImageContainer.style.display = 'none';
        this.fileInput.value = '';
        this.saveImageToLocalStorage();
        this.showResults('Upload an image and enter a prompt to get started.', 'default');
        this.showMessage('Image cleared', 'success');
    }
    async generateImage() {
        const prompt = this.imagePrompt.value.trim();
        if (!prompt) {
            this.showMessage('Please enter a prompt describing what you want to do with the image', 'error');
            return;
        }
        if (!this.currentImageData) {
            this.showMessage('Please upload an image first', 'error');
            return;
        }
        this.showResults('Generating image...', 'loading');
        this.generateButton.textContent = 'Generating...';
        this.generateButton.setAttribute('disabled', 'true');
        try {
            const response = await window.electronAPI.images.generateImage(prompt, this.currentImageData);
            if (!response.success) {
                throw new Error(response.error || 'Unknown error occurred');
            }
            let resultHtml = '';
            if (response.type === 'image') {
                resultHtml = `
          <div class="generation-result">
            <p><strong>Your Prompt:</strong> ${utils_1.Utils.escapeHtml(prompt)}</p>
            <div class="generated-image-container">
              <div class="image-container">
                <p><strong>Generated Image:</strong></p>
                <img src="${response.result}" alt="Generated image" class="generated-image" id="generated-image-${Date.now()}">
                <div class="image-actions">
                  <button class="btn btn-secondary copy-image-btn" data-image-src="${response.result}">Copy Image</button>
                </div>
              </div>
            </div>
          </div>
        `;
                this.showMessage('Image generated successfully!', 'success');
            }
            else {
                resultHtml = `
          <div class="generation-result">
            <p><strong>Your Prompt:</strong> ${utils_1.Utils.escapeHtml(prompt)}</p>
            <img src="${this.currentImageData}" alt="Original image" class="generated-image">
            <div class="ai-response">
              <p><strong>AI Response:</strong></p>
              <div class="response-text">${utils_1.Utils.escapeHtml(response.result || 'No response generated')}</div>
            </div>
          </div>
        `;
                this.showMessage('AI response generated!', 'success');
            }
            this.showResults(resultHtml, 'success');
            this.addCopyButtonListeners();
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            this.showResults(`Error: ${errorMessage}`, 'error');
            this.showMessage('Failed to generate image', 'error');
        }
        finally {
            this.generateButton.textContent = 'Generate Image';
            this.generateButton.removeAttribute('disabled');
        }
    }
    showResults(content, type) {
        this.imageResults.innerHTML = content;
        this.imageResults.className = `image-results ${type}`;
    }
    addCopyButtonListeners() {
        const copyButtons = this.imageResults.querySelectorAll('.copy-image-btn');
        copyButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                const target = e.target;
                const imageSrc = target.getAttribute('data-image-src');
                if (imageSrc) {
                    try {
                        await this.copyImageToClipboard(imageSrc);
                        this.showMessage('Image copied to clipboard!', 'success');
                        const originalText = target.textContent;
                        target.textContent = 'Copied!';
                        target.disabled = true;
                        setTimeout(() => {
                            target.textContent = originalText;
                            target.disabled = false;
                        }, 2000);
                    }
                    catch (error) {
                        this.showMessage('Failed to copy image to clipboard', 'error');
                    }
                }
            });
        });
    }
    async copyImageToClipboard(dataUrl) {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        if (navigator.clipboard && window.ClipboardItem) {
            const clipboardItem = new window.ClipboardItem({
                [blob.type]: blob
            });
            await navigator.clipboard.write([clipboardItem]);
        }
        else {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx?.drawImage(img, 0, 0);
                canvas.toBlob(async (blob) => {
                    if (blob && navigator.clipboard && window.ClipboardItem) {
                        const clipboardItem = new window.ClipboardItem({
                            [blob.type]: blob
                        });
                        await navigator.clipboard.write([clipboardItem]);
                    }
                });
            };
            img.src = dataUrl;
        }
    }
    saveImageToLocalStorage() {
        try {
            if (this.currentImageData) {
                localStorage.setItem('currentImage', this.currentImageData);
            }
            else {
                localStorage.removeItem('currentImage');
            }
        }
        catch (error) {
            console.error('Failed to save image to localStorage:', error);
        }
    }
    loadSavedImage() {
        try {
            const savedImage = localStorage.getItem('currentImage');
            if (savedImage) {
                this.currentImageData = savedImage;
                this.displayCurrentImage(savedImage);
            }
        }
        catch (error) {
            console.error('Failed to load saved image:', error);
        }
    }
    showMessage(message, type) {
        utils_1.Utils.showMessage(message, type);
    }
}
exports.ImagesManager = ImagesManager;
//# sourceMappingURL=ImagesManager.js.map