// Drift-free Pomodoro Web Worker
let timerId = null;
let targetEndTime = 0;
let remainingSeconds = 25 * 60;
let isRunning = false;

function clearTimer() {
  if (timerId !== null) {
    self.clearInterval(timerId);
    timerId = null;
  }
}

self.onmessage = (event) => {
  const { type, seconds } = event.data || {};

  if (type === 'START') {
    if (typeof seconds === 'number') {
      remainingSeconds = seconds;
    }
    if (remainingSeconds <= 0) return;

    isRunning = true;
    targetEndTime = Date.now() + remainingSeconds * 1000;
    clearTimer();

    timerId = self.setInterval(() => {
      if (!isRunning) return;
      const diff = Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000));
      remainingSeconds = diff;
      self.postMessage({ type: 'TICK', remainingSeconds });

      if (diff <= 0) {
        isRunning = false;
        clearTimer();
        self.postMessage({ type: 'COMPLETE' });
      }
    }, 250);
  } else if (type === 'PAUSE') {
    isRunning = false;
    clearTimer();
    self.postMessage({ type: 'PAUSED', remainingSeconds });
  } else if (type === 'RESET') {
    isRunning = false;
    clearTimer();
    remainingSeconds = typeof seconds === 'number' ? seconds : 25 * 60;
    self.postMessage({ type: 'TICK', remainingSeconds });
  }
};
