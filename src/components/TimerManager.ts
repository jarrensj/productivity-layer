import { Utils } from '../utils';

export class TimerManager {
  private timerDisplay: HTMLElement;
  private timerStatus: HTMLElement;
  private hoursInput: HTMLInputElement;
  private minutesInput: HTMLInputElement;
  private secondsInput: HTMLInputElement;
  private startButton: HTMLElement;
  private pauseButton: HTMLElement;
  private resetButton: HTMLElement;
  private presetButtons: NodeListOf<HTMLElement>;

  private timeRemaining: number = 0;
  private timerId: number | null = null;
  private isRunning: boolean = false;
  private isPaused: boolean = false;

  constructor() {
    this.timerDisplay = document.getElementById('timer-display')!;
    this.timerStatus = document.getElementById('timer-status')!;
    this.hoursInput = document.getElementById('timer-hours') as HTMLInputElement;
    this.minutesInput = document.getElementById('timer-minutes') as HTMLInputElement;
    this.secondsInput = document.getElementById('timer-seconds') as HTMLInputElement;
    this.startButton = document.getElementById('start-timer')!;
    this.pauseButton = document.getElementById('pause-timer')!;
    this.resetButton = document.getElementById('reset-timer')!;
    this.presetButtons = document.querySelectorAll('.preset-btn');

    this.init();
  }

  private init() {
    this.setupEventListeners();
    this.setupGlobalEventListeners();
    this.loadTimerState();
    this.updateDisplay();
    this.updateButtonStates();
  }

  private setupGlobalEventListeners() {
    document.addEventListener('resetAllSettings', () => {
      this.reset();
    });
  }

  private setupEventListeners() {
    this.startButton.addEventListener('click', () => this.start());
    this.pauseButton.addEventListener('click', () => this.pause());
    this.resetButton.addEventListener('click', () => this.reset());

    this.presetButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const time = parseInt((e.target as HTMLElement).dataset.time || '0');
        this.setTime(time);
      });
    });

    [this.hoursInput, this.minutesInput, this.secondsInput].forEach(input => {
      input.addEventListener('input', () => this.onInputChange());
      input.addEventListener('blur', () => this.validateInput(input));
    });
  }

  private start() {
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
      } else {
        Utils.showMessage('Please set a time before starting the timer', 'warning');
      }
    }
  }

  private pause() {
    if (this.isRunning) {
      this.isRunning = false;
      this.isPaused = true;
      this.stopCountdown();
      this.updateButtonStates();
      this.updateStatus('Paused');
      this.saveTimerState();
    }
  }

  private reset() {
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

  private startCountdown() {
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

  private stopCountdown() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    if (this.isPaused) {
      this.timerDisplay.parentElement?.classList.add('paused');
      this.timerDisplay.parentElement?.classList.remove('running', 'finished');
    } else {
      this.timerDisplay.parentElement?.classList.remove('running', 'paused', 'finished');
    }
  }

  private onTimerComplete() {
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
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification('Timer Complete!', {
            body: 'Your timer has finished.',
            icon: '/icon.png'
          });
        }
      });
    }

    Utils.showMessage('Timer completed!', 'success');
  }

  private setTime(seconds: number) {
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

  private updateInputsFromTime() {
    const hours = Math.floor(this.timeRemaining / 3600);
    const minutes = Math.floor((this.timeRemaining % 3600) / 60);
    const seconds = this.timeRemaining % 60;

    this.hoursInput.value = hours > 0 ? hours.toString() : '';
    this.minutesInput.value = minutes > 0 ? minutes.toString() : '';
    this.secondsInput.value = seconds > 0 ? seconds.toString() : '';
  }

  private updateDisplay() {
    const hours = Math.floor(this.timeRemaining / 3600);
    const minutes = Math.floor((this.timeRemaining % 3600) / 60);
    const seconds = this.timeRemaining % 60;

    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    this.timerDisplay.textContent = timeString;
  }

  private updateButtonStates() {
    const hasTime = this.timeRemaining > 0 || this.hasInputTime();

    requestAnimationFrame(() => {
      if (this.isRunning) {
        this.startButton.style.display = 'none';
        this.pauseButton.style.display = 'inline-block';
        (this.pauseButton as HTMLButtonElement).disabled = false;
      } else {
        this.startButton.style.display = 'inline-block';
        this.pauseButton.style.display = 'none';
        (this.startButton as HTMLButtonElement).disabled = !hasTime;
      }

      (this.resetButton as HTMLButtonElement).disabled = !hasTime && !this.isRunning && !this.isPaused;
    });
  }

  private updateStatus(status: string) {
    this.timerStatus.textContent = status;
  }

  private hasInputTime(): boolean {
    const hours = parseInt(this.hoursInput.value) || 0;
    const minutes = parseInt(this.minutesInput.value) || 0;
    const seconds = parseInt(this.secondsInput.value) || 0;
    return hours > 0 || minutes > 0 || seconds > 0;
  }

  private onInputChange() {
    if (!this.isRunning && !this.isPaused) {
      this.timeRemaining = 0;
      this.updateStatus('Ready to start');
    }
    this.updateButtonStates();
  }

  private validateInput(input: HTMLInputElement) {
    const value = parseInt(input.value);
    const max = input === this.hoursInput ? 23 : 59;

    if (isNaN(value) || value < 0) {
      input.value = '';
    } else if (value > max) {
      input.value = max.toString();
    }
  }

  private clearInputs() {
    this.hoursInput.value = '';
    this.minutesInput.value = '';
    this.secondsInput.value = '';
  }

  private removeTimerClasses() {
    this.timerDisplay.parentElement?.classList.remove('running', 'paused', 'finished');
  }

  private saveTimerState() {
    const state = {
      timeRemaining: this.timeRemaining,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      timestamp: Date.now()
    };

    try {
      localStorage.setItem('timerState', JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save timer state:', error);
    }
  }

  private loadTimerState() {
    try {
      const stored = localStorage.getItem('timerState');
      if (!stored) return;

      const state = JSON.parse(stored);
      const timeDiff = Math.floor((Date.now() - state.timestamp) / 1000);

      if (state.isRunning && state.timeRemaining > 0) {
        this.timeRemaining = Math.max(0, state.timeRemaining - timeDiff);

        if (this.timeRemaining > 0) {
          this.isRunning = true;
          this.isPaused = false;
          this.startCountdown();
          this.updateStatus('Running...');
        } else {
          this.onTimerComplete();
        }
      } else if (state.isPaused) {
        this.timeRemaining = state.timeRemaining;
        this.isPaused = true;
        this.isRunning = false;
        this.updateInputsFromTime();
        this.updateStatus('Paused');
        this.timerDisplay.parentElement?.classList.add('paused');
      } else {
        this.timeRemaining = state.timeRemaining;
        this.updateInputsFromTime();
      }

      this.updateButtonStates();
    } catch (error) {
      console.error('Failed to load timer state:', error);
    }
  }
}
