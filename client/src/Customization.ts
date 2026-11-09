/**
 * Customization screen — Skin selection, color pickers, pattern,
 * head shape, trail effect, and live preview canvas.
 */

export interface SkinConfig {
  skinId: number;
  primaryColor: string;
  secondaryColor: string;
  pattern: string;
  headShape: string;
  trailEffect: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const BASE_SKINS = [
  { id: 0, name: 'Default' },
  { id: 1, name: 'Viper' },
  { id: 2, name: 'Cobra' },
  { id: 3, name: 'Python' },
  { id: 4, name: 'Mamba' },
  { id: 5, name: 'Rattler' },
  { id: 6, name: 'Sidewinder' },
  { id: 7, name: 'Anaconda' },
  { id: 8, name: 'Coral' },
  { id: 9, name: 'Boa' },
  { id: 10, name: 'Kingsnake' },
  { id: 11, name: 'Asp' },
  { id: 12, name: 'Basilisk' },
  { id: 13, name: 'Hydra' },
  { id: 14, name: 'Wyrm' },
  { id: 15, name: 'Drake' },
  { id: 16, name: 'Naga' },
  { id: 17, name: 'Serpent' },
  { id: 18, name: 'Ouroboros' },
  { id: 19, name: 'Leviathan' },
  { id: 20, name: 'Shadow' },
  { id: 21, name: 'Prism' },
  { id: 22, name: 'Toxic' },
  { id: 23, name: 'Frost' },
];

const PATTERNS = ['solid', 'striped', 'gradient', 'dotted', 'zigzag'];

const HEAD_SHAPES = [
  'round',
  'pointed',
  'flat',
  'diamond',
  'arrow',
  'crown',
  'horned',
  'fanged',
];

const TRAIL_EFFECTS = ['none', 'sparkles', 'flames', 'bubbles', 'lightning', 'rainbow'];

// ─── Storage key ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'snakeking_customization';

// ─── Class ────────────────────────────────────────────────────────────────────

export class Customization {
  private container: HTMLDivElement;
  private config: SkinConfig;
  private onChange: (config: SkinConfig) => void;
  private previewCanvas!: HTMLCanvasElement;

  constructor(parent: HTMLElement, onChange: (config: SkinConfig) => void) {
    this.onChange = onChange;
    this.config = this.loadConfig();

    this.container = document.createElement('div');
    this.container.className = 'customization-container';
    this.container.style.display = 'none';
    parent.appendChild(this.container);

    this.buildUI();
  }

  show(): void {
    this.container.style.display = 'flex';
    this.renderPreview();
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  getConfig(): SkinConfig {
    return { ...this.config };
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private buildUI(): void {
    const title = document.createElement('h2');
    title.textContent = 'Customize Your Snake';
    title.className = 'customization-title';
    this.container.appendChild(title);

    // Main layout: left = options, right = preview
    const layout = document.createElement('div');
    layout.className = 'customization-layout';
    this.container.appendChild(layout);

    const optionsPanel = document.createElement('div');
    optionsPanel.className = 'customization-options';
    layout.appendChild(optionsPanel);

    const previewPanel = document.createElement('div');
    previewPanel.className = 'customization-preview';
    layout.appendChild(previewPanel);

    // Skin selection
    this.buildSkinSelection(optionsPanel);

    // Color pickers
    this.buildColorPickers(optionsPanel);

    // Pattern selection
    this.buildPatternSelection(optionsPanel);

    // Head shape selection
    this.buildHeadShapeSelection(optionsPanel);

    // Trail effect selection
    this.buildTrailEffectSelection(optionsPanel);

    // Preview canvas
    this.previewCanvas = document.createElement('canvas');
    this.previewCanvas.width = 200;
    this.previewCanvas.height = 200;
    this.previewCanvas.className = 'customization-canvas';
    previewPanel.appendChild(this.previewCanvas);
  }

  // ─── Skin Selection ───────────────────────────────────────────────────

  private buildSkinSelection(parent: HTMLElement): void {
    const section = this.createSection('Skin', parent);
    const grid = document.createElement('div');
    grid.className = 'skin-grid';

    for (const skin of BASE_SKINS) {
      const btn = document.createElement('button');
      btn.className = 'skin-btn';
      btn.textContent = skin.name;
      btn.title = skin.name;
      if (skin.id === this.config.skinId) {
        btn.classList.add('selected');
      }
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.skin-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.config.skinId = skin.id;
        this.persist();
      });
      grid.appendChild(btn);
    }

    section.appendChild(grid);
  }

  // ─── Color Pickers ────────────────────────────────────────────────────

  private buildColorPickers(parent: HTMLElement): void {
    const section = this.createSection('Colors', parent);

    const primaryLabel = document.createElement('label');
    primaryLabel.textContent = 'Primary';
    const primaryInput = document.createElement('input');
    primaryInput.type = 'color';
    primaryInput.value = this.config.primaryColor;
    primaryInput.addEventListener('input', () => {
      this.config.primaryColor = primaryInput.value;
      this.persist();
    });
    section.appendChild(primaryLabel);
    section.appendChild(primaryInput);

    const secondaryLabel = document.createElement('label');
    secondaryLabel.textContent = 'Secondary';
    const secondaryInput = document.createElement('input');
    secondaryInput.type = 'color';
    secondaryInput.value = this.config.secondaryColor;
    secondaryInput.addEventListener('input', () => {
      this.config.secondaryColor = secondaryInput.value;
      this.persist();
    });
    section.appendChild(secondaryLabel);
    section.appendChild(secondaryInput);
  }

  // ─── Pattern Selection ────────────────────────────────────────────────

  private buildPatternSelection(parent: HTMLElement): void {
    const section = this.createSection('Pattern', parent);
    const group = document.createElement('div');
    group.className = 'pattern-group';

    for (const pattern of PATTERNS) {
      const btn = document.createElement('button');
      btn.className = 'pattern-btn';
      btn.textContent = pattern;
      if (pattern === this.config.pattern) {
        btn.classList.add('selected');
      }
      btn.addEventListener('click', () => {
        group.querySelectorAll('.pattern-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.config.pattern = pattern;
        this.persist();
      });
      group.appendChild(btn);
    }

    section.appendChild(group);
  }

  // ─── Head Shape ───────────────────────────────────────────────────────

  private buildHeadShapeSelection(parent: HTMLElement): void {
    const section = this.createSection('Head Shape', parent);
    const group = document.createElement('div');
    group.className = 'headshape-group';

    for (const shape of HEAD_SHAPES) {
      const btn = document.createElement('button');
      btn.className = 'headshape-btn';
      btn.textContent = shape;
      if (shape === this.config.headShape) {
        btn.classList.add('selected');
      }
      btn.addEventListener('click', () => {
        group.querySelectorAll('.headshape-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.config.headShape = shape;
        this.persist();
      });
      group.appendChild(btn);
    }

    section.appendChild(group);
  }

  // ─── Trail Effect ─────────────────────────────────────────────────────

  private buildTrailEffectSelection(parent: HTMLElement): void {
    const section = this.createSection('Trail Effect', parent);
    const group = document.createElement('div');
    group.className = 'trail-group';

    for (const effect of TRAIL_EFFECTS) {
      const btn = document.createElement('button');
      btn.className = 'trail-btn';
      btn.textContent = effect;
      if (effect === this.config.trailEffect) {
        btn.classList.add('selected');
      }
      btn.addEventListener('click', () => {
        group.querySelectorAll('.trail-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.config.trailEffect = effect;
        this.persist();
      });
      group.appendChild(btn);
    }

    section.appendChild(group);
  }

  // ─── Preview ──────────────────────────────────────────────────────────

  private renderPreview(): void {
    const ctx = this.previewCanvas.getContext('2d');
    if (!ctx) return;

    const w = this.previewCanvas.width;
    const h = this.previewCanvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    // Draw a simple snake body preview
    const segmentCount = 8;
    const segmentRadius = 10;
    const startX = 40;
    const startY = h / 2;

    for (let i = segmentCount - 1; i >= 0; i--) {
      const x = startX + i * (segmentRadius * 1.6);
      const y = startY + Math.sin(i * 0.8) * 12;

      ctx.beginPath();
      ctx.arc(x, y, segmentRadius, 0, Math.PI * 2);

      // Apply pattern coloring
      if (this.config.pattern === 'striped' && i % 2 === 0) {
        ctx.fillStyle = this.config.secondaryColor;
      } else if (this.config.pattern === 'dotted' && i % 3 === 0) {
        ctx.fillStyle = this.config.secondaryColor;
      } else if (this.config.pattern === 'gradient') {
        const t = i / segmentCount;
        ctx.fillStyle = this.lerpColor(this.config.primaryColor, this.config.secondaryColor, t);
      } else if (this.config.pattern === 'zigzag' && i % 2 === 1) {
        ctx.fillStyle = this.config.secondaryColor;
      } else {
        ctx.fillStyle = this.config.primaryColor;
      }

      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.stroke();
    }

    // Draw head shape indicator
    this.drawHeadPreview(ctx, startX, startY, segmentRadius);

    // Draw trail indicator text
    if (this.config.trailEffect !== 'none') {
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px sans-serif';
      ctx.fillText(`Trail: ${this.config.trailEffect}`, 10, h - 12);
    }
  }

  private drawHeadPreview(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number
  ): void {
    ctx.fillStyle = this.config.primaryColor;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;

    switch (this.config.headShape) {
      case 'pointed':
        ctx.beginPath();
        ctx.moveTo(x + radius * 1.5, y);
        ctx.lineTo(x - radius * 0.5, y - radius);
        ctx.lineTo(x - radius * 0.5, y + radius);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case 'diamond':
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x, y - radius);
        ctx.lineTo(x - radius, y);
        ctx.lineTo(x, y + radius);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case 'flat':
        ctx.fillRect(x - radius, y - radius * 0.7, radius * 2, radius * 1.4);
        ctx.strokeRect(x - radius, y - radius * 0.7, radius * 2, radius * 1.4);
        break;
      default:
        // round (and others) just use a circle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
    }

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + 2, y - 4, 3, 0, Math.PI * 2);
    ctx.arc(x + 2, y + 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x + 3, y - 4, 1.5, 0, Math.PI * 2);
    ctx.arc(x + 3, y + 4, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── Utilities ────────────────────────────────────────────────────────

  private createSection(label: string, parent: HTMLElement): HTMLDivElement {
    const section = document.createElement('div');
    section.className = 'customization-section';
    const heading = document.createElement('h4');
    heading.textContent = label;
    section.appendChild(heading);
    parent.appendChild(section);
    return section;
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    this.onChange(this.getConfig());
    this.renderPreview();
  }

  private loadConfig(): SkinConfig {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as SkinConfig;
      } catch {
        // fall through to defaults
      }
    }
    return {
      skinId: 0,
      primaryColor: '#22c55e',
      secondaryColor: '#15803d',
      pattern: 'solid',
      headShape: 'round',
      trailEffect: 'none',
    };
  }

  private lerpColor(a: string, b: string, t: number): string {
    const parseHex = (hex: string) => {
      const h = hex.replace('#', '');
      return [
        parseInt(h.substring(0, 2), 16),
        parseInt(h.substring(2, 4), 16),
        parseInt(h.substring(4, 6), 16),
      ];
    };
    const [r1, g1, b1] = parseHex(a);
    const [r2, g2, b2] = parseHex(b);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const bl = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r},${g},${bl})`;
  }
}
