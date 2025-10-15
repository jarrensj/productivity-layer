"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimerManager = void 0;
const utils_1 = require("../utils");
class TimerManager {
    timerDisplay;
    timerStatus;
    hoursInput;
    minutesInput;
    secondsInput;
    startButton;
    pauseButton;
    resetButton;
    presetButtons;
    timeRemaining = 0;
    timerId = null;
    isRunning = false;
    isPaused = false;
    constructor() {
        this.timerDisplay = document.getElementById('timer-display');
        this.timerStatus = document.getElementById('timer-status');
        this.hoursInput = document.getElementById('timer-hours');
        this.minutesInput = document.getElementById('timer-minutes');
        this.secondsInput = document.getElementById('timer-seconds');
        this.startButton = document.getElementById('start-timer');
        this.pauseButton = document.getElementById('pause-timer');
        this.resetButton = document.getElementById('reset-timer');
        this.presetButtons = document.querySelectorAll('.preset-btn');
        this.init();
    }
    init() {
        this.setupEventListeners();
        this.setupGlobalEventListeners();
        this.loadTimerState();
        this.updateDisplay();
        this.updateButtonStates();
    }
    setupGlobalEventListeners() {
        document.addEventListener('resetAllSettings', () => {
            this.reset();
        });
    }
    setupEventListeners() {
        this.startButton.addEventListener('click', () => this.start());
        this.pauseButton.addEventListener('click', () => this.pause());
        this.resetButton.addEventListener('click', () => this.reset());
        this.presetButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const time = parseInt(e.target.dataset.time || '0');
                this.setTime(time);
            });
        });
        [this.hoursInput, this.minutesInput, this.secondsInput].forEach(input => {
            input.addEventListener('input', () => this.onInputChange());
            input.addEventListener('blur', () => this.validateInput(input));
        });
    }
    start() {
        if (!this.isRunning) {
            if (this.timeRemaining === 0) {
                const hours = parseInt(this.hoursInput.value) || 0;
                const minutes = parseInt(this.minutesInput.value) || 0;
                const seconds = parseInt(this.secondsInput.value) || 0;
                this.timeRemaining = hours * 3600 + minutes * 60 + seconds;
            }
            if (this.timeRemaining > 0) {
                this.isRunning = true;
                this.isPaused = false;
                this.updateButtonStates();
                this.updateStatus('Running...');
                this.startCountdown();
                this.saveTimerState();
            }
            else {
                utils_1.Utils.showMessage('Please set a time before starting the timer', 'warning');
            }
        }
    }
    pause() {
        if (this.isRunning) {
            this.isRunning = false;
            this.isPaused = true;
            this.stopCountdown();
            this.updateButtonStates();
            this.updateStatus('Paused');
            this.saveTimerState();
        }
    }
    reset() {
        this.isRunning = false;
        this.isPaused = false;
        this.timeRemaining = 0;
        this.stopCountdown();
        this.clearInputs();
        this.updateDisplay();
        this.updateButtonStates();
        this.updateStatus('Ready to start');
        this.removeTimerClasses();
        this.saveTimerState();
    }
    startCountdown() {
        this.timerId = window.setInterval(() => {
            this.timeRemaining--;
            this.updateDisplay();
            this.saveTimerState();
            if (this.timeRemaining <= 0) {
                this.onTimerComplete();
            }
        }, 1000);
        this.timerDisplay.parentElement?.classList.add('running');
        this.timerDisplay.parentElement?.classList.remove('paused', 'finished');
    }
    stopCountdown() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
        if (this.isPaused) {
            this.timerDisplay.parentElement?.classList.add('paused');
            this.timerDisplay.parentElement?.classList.remove('running', 'finished');
        }
        else {
            this.timerDisplay.parentElement?.classList.remove('running', 'paused', 'finished');
        }
    }
    onTimerComplete() {
        this.isRunning = false;
        this.isPaused = false;
        this.timeRemaining = 0;
        this.stopCountdown();
        this.updateDisplay();
        this.updateButtonStates();
        this.updateStatus("Time's up!");
        this.timerDisplay.parentElement?.classList.add('finished');
        this.timerDisplay.parentElement?.classList.remove('running', 'paused');
        this.saveTimerState();
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Timer Complete!', {
                body: 'Your timer has finished.',
                icon: '/icon.png'
            });
        }
        else if ('Notification' in window && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification('Timer Complete!', {
                        body: 'Your timer has finished.',
                        icon: '/icon.png'
                    });
                }
            });
        }
        utils_1.Utils.showMessage('Timer completed!', 'success');
    }
    setTime(seconds) {
        this.isRunning = false;
        this.isPaused = false;
        this.stopCountdown();
        this.timeRemaining = seconds;
        this.updateInputsFromTime();
        this.updateDisplay();
        this.updateButtonStates();
        this.updateStatus('Ready to start');
        this.removeTimerClasses();
        this.saveTimerState();
    }
    updateInputsFromTime() {
        const hours = Math.floor(this.timeRemaining / 3600);
        const minutes = Math.floor((this.timeRemaining % 3600) / 60);
        const seconds = this.timeRemaining % 60;
        this.hoursInput.value = hours > 0 ? hours.toString() : '';
        this.minutesInput.value = minutes > 0 ? minutes.toString() : '';
        this.secondsInput.value = seconds > 0 ? seconds.toString() : '';
    }
    updateDisplay() {
        const hours = Math.floor(this.timeRemaining / 3600);
        const minutes = Math.floor((this.timeRemaining % 3600) / 60);
        const seconds = this.timeRemaining % 60;
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        this.timerDisplay.textContent = timeString;
    }
    updateButtonStates() {
        const hasTime = this.timeRemaining > 0 || this.hasInputTime();
        requestAnimationFrame(() => {
            if (this.isRunning) {
                this.startButton.style.display = 'none';
                this.pauseButton.style.display = 'inline-block';
                this.pauseButton.disabled = false;
            }
            else {
                this.startButton.style.display = 'inline-block';
                this.pauseButton.style.display = 'none';
                this.startButton.disabled = !hasTime;
            }
            this.resetButton.disabled = !hasTime && !this.isRunning && !this.isPaused;
        });
    }
    updateStatus(status) {
        this.timerStatus.textContent = status;
    }
    hasInputTime() {
        const hours = parseInt(this.hoursInput.value) || 0;
        const minutes = parseInt(this.minutesInput.value) || 0;
        const seconds = parseInt(this.secondsInput.value) || 0;
        return hours > 0 || minutes > 0 || seconds > 0;
    }
    onInputChange() {
        if (!this.isRunning && !this.isPaused) {
            this.timeRemaining = 0;
            this.updateStatus('Ready to start');
        }
        this.updateButtonStates();
    }
    validateInput(input) {
        const value = parseInt(input.value);
        const max = input === this.hoursInput ? 23 : 59;
        if (isNaN(value) || value < 0) {
            input.value = '';
        }
        else if (value > max) {
            input.value = max.toString();
        }
    }
    clearInputs() {
        this.hoursInput.value = '';
        this.minutesInput.value = '';
        this.secondsInput.value = '';
    }
    removeTimerClasses() {
        this.timerDisplay.parentElement?.classList.remove('running', 'paused', 'finished');
    }
    saveTimerState() {
        const state = {
            timeRemaining: this.timeRemaining,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            timestamp: Date.now()
        };
        try {
            localStorage.setItem('timerState', JSON.stringify(state));
        }
        catch (error) {
            console.error('Failed to save timer state:', error);
        }
    }
    loadTimerState() {
        try {
            const stored = localStorage.getItem('timerState');
            if (!stored)
                return;
            const state = JSON.parse(stored);
            const timeDiff = Math.floor((Date.now() - state.timestamp) / 1000);
            if (state.isRunning && state.timeRemaining > 0) {
                this.timeRemaining = Math.max(0, state.timeRemaining - timeDiff);
                if (this.timeRemaining > 0) {
                    this.isRunning = true;
                    this.isPaused = false;
                    this.startCountdown();
                    this.updateStatus('Running...');
                }
                else {
                    this.onTimerComplete();
                }
            }
            else if (state.isPaused) {
                this.timeRemaining = state.timeRemaining;
                this.isPaused = true;
                this.isRunning = false;
                this.updateInputsFromTime();
                this.updateStatus('Paused');
                this.timerDisplay.parentElement?.classList.add('paused');
            }
            else {
                this.timeRemaining = state.timeRemaining;
                this.updateInputsFromTime();
            }
            this.updateButtonStates();
        }
        catch (error) {
            console.error('Failed to load timer state:', error);
        }
    }
}
exports.TimerManager = TimerManager;
//# sourceMappingURL=TimerManager.js.map