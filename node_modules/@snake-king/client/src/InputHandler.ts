import { Vec2 } from '@snake-king/shared';

export type InputCallback = (type: 'direction' | 'boost_start' | 'boost_end', value?: number) => void;

export class InputHandler {
  private canvas: HTMLCanvasElement;
  private callback: InputCallback;
  private isMobile: boolean;
  private isBoosting: boolean = false;
  private lastDirection: number = 0;
  private centerX: number = 0;
  private centerY: number = 0;

  // Touch tracking
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private boostTouchId: number | null = null;

  // Boost button dimensions
  private readonly BOOST_BUTTON_SIZE = 60;
  private readonly MIN_TOUCH_TARGET = 44;
  private readonly MIN_DRAG_DISTANCE = 10;

  // Bound handlers for cleanup
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;

  constructor(canvas: HTMLCanvasElement, callback: InputCallback) {
    this.canvas = canvas;
    this.callback = callback;
    this.isMobile = InputHandler.detectMobile();

    this.centerX = canvas.clientWidth / 2;
    this.centerY = canvas.clientHeight / 2;

    // Bind handlers
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundMouseDown = this.handleMouseDown.bind(this);
    this.boundMouseUp = this.handleMouseUp.bind(this);
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    this.boundTouchStart = this.handleTouchStart.bind(this);
    this.boundTouchMove = this.handleTouchMove.bind(this);
    this.boundTouchEnd = this.handleTouchEnd.bind(this);
  }

  /** Start listening for input events */
  start(): void {
    if (this.isMobile) {
      this.canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
      this.canvas.addEventListener('touchmove', this.boundTouchMove, { passive: false });
      this.canvas.addEventListener('touchend', this.boundTouchEnd, { passive: false });
      this.canvas.addEventListener('touchcancel', this.boundTouchEnd, { passive: false });
    } else {
      this.canvas.addEventListener('mousemove', this.boundMouseMove);
      this.canvas.addEventListener('mousedown', this.boundMouseDown);
      this.canvas.addEventListener('mouseup', this.boundMouseUp);
      window.addEventListener('keydown', this.boundKeyDown);
      window.addEventListener('keyup', this.boundKeyUp);
    }
  }

  /** Stop listening for input events */
  stop(): void {
    if (this.isMobile) {
      this.canvas.removeEventListener('touchstart', this.boundTouchStart);
      this.canvas.removeEventListener('touchmove', this.boundTouchMove);
      this.canvas.removeEventListener('touchend', this.boundTouchEnd);
      this.canvas.removeEventListener('touchcancel', this.boundTouchEnd);
    } else {
      this.canvas.removeEventListener('mousemove', this.boundMouseMove);
      this.canvas.removeEventListener('mousedown', this.boundMouseDown);
      this.canvas.removeEventListener('mouseup', this.boundMouseUp);
      window.removeEventListener('keydown', this.boundKeyDown);
      window.removeEventListener('keyup', this.boundKeyUp);
    }
  }

  /** Update center position (call when canvas or player position changes) */
  updateCenter(screenCenter: Vec2): void {
    this.centerX = screenCenter.x;
    this.centerY = screenCenter.y;
  }

  /** Check if device is mobile */
  static detectMobile(): boolean {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    );
  }

  /** Render mobile boost button (if on mobile) */
  renderMobileControls(ctx: CanvasRenderingContext2D): void {
    if (!this.isMobile) return;

    const buttonSize = Math.max(this.BOOST_BUTTON_SIZE, this.MIN_TOUCH_TARGET);
    const { x, y } = this.getBoostButtonPosition();

    ctx.save();

    // Button background
    ctx.beginPath();
    ctx.roundRect(
      x - buttonSize / 2,
      y - buttonSize / 2,
      buttonSize,
      buttonSize,
      12
    );
    ctx.fillStyle = this.isBoosting
      ? 'rgba(255, 100, 50, 0.8)'
      : 'rgba(255, 200, 50, 0.6)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Button icon (lightning bolt)
    ctx.fillStyle = '#ffffff';
    ctx.font = `${buttonSize * 0.5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', x, y);

    ctx.restore();
  }

  // --- Desktop Handlers ---

  private handleMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const angle = Math.atan2(mouseY - this.centerY, mouseX - this.centerX);
    this.lastDirection = angle;
    this.callback('direction', angle);
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button === 0) {
      // Left click
      this.isBoosting = true;
      this.callback('boost_start');
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.isBoosting = false;
      this.callback('boost_end');
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      this.isBoosting = true;
      this.callback('boost_start');
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    if (e.code === 'Space') {
      e.preventDefault();
      this.isBoosting = false;
      this.callback('boost_end');
    }
  }

  // --- Mobile Handlers ---

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const rect = this.canvas.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      const touchY = touch.clientY - rect.top;

      // Check if touch is on boost button
      if (this.isOnBoostButton(touchX, touchY)) {
        this.boostTouchId = touch.identifier;
        this.isBoosting = true;
        this.callback('boost_start');
      } else {
        // Direction touch
        this.touchStartX = touchX;
        this.touchStartY = touchY;
      }
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      // Skip boost button touch
      if (touch.identifier === this.boostTouchId) continue;

      const rect = this.canvas.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      const touchY = touch.clientY - rect.top;

      const dx = touchX - this.touchStartX;
      const dy = touchY - this.touchStartY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Only emit direction if drag exceeds minimum distance
      if (distance >= this.MIN_DRAG_DISTANCE) {
        const angle = Math.atan2(dy, dx);
        this.lastDirection = angle;
        this.callback('direction', angle);
      }
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      if (touch.identifier === this.boostTouchId) {
        this.boostTouchId = null;
        this.isBoosting = false;
        this.callback('boost_end');
      }
    }
  }

  // --- Utility ---

  private getBoostButtonPosition(): Vec2 {
    const buttonSize = Math.max(this.BOOST_BUTTON_SIZE, this.MIN_TOUCH_TARGET);
    const margin = 20;
    return {
      x: this.canvas.width - margin - buttonSize / 2,
      y: this.canvas.height - margin - buttonSize / 2,
    };
  }

  private isOnBoostButton(x: number, y: number): boolean {
    const buttonSize = Math.max(this.BOOST_BUTTON_SIZE, this.MIN_TOUCH_TARGET);
    const pos = this.getBoostButtonPosition();
    const halfSize = buttonSize / 2;

    return (
      x >= pos.x - halfSize &&
      x <= pos.x + halfSize &&
      y >= pos.y - halfSize &&
      y <= pos.y + halfSize
    );
  }
}
