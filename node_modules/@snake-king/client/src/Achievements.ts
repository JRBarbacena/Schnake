/**
 * Achievement System for "Who's the Snake King"
 * Tracks 30+ achievements across categories with notifications and localStorage persistence.
 */

export type AchievementCategory = 'growth' | 'combat' | 'survival' | 'collection' | 'mastery';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  progress: number;
  target: number;
  completed: boolean;
  reward?: string;
}

interface AchievementNotification {
  text: string;
  timer: number;
}

interface AchievementStats {
  mass: number;
  eliminations: number;
  survivalTime: number;
  orbsCollected: number;
}

const STORAGE_KEY = 'snake-king-achievements';
const NOTIFICATION_DURATION = 5000; // 5 seconds in ms

const CATEGORY_SKIN_REWARDS: Record<AchievementCategory, string> = {
  growth: 'Titan Skin',
  combat: 'Warrior Skin',
  survival: 'Ghost Skin',
  collection: 'Collector Skin',
  mastery: 'Crown Skin',
};

function createDefaultAchievements(): Achievement[] {
  return [
    // Growth category (7 achievements)
    { id: 'growth_1', name: 'Baby Snake', description: 'Reach mass of 50', category: 'growth', progress: 0, target: 50, completed: false },
    { id: 'growth_2', name: 'Growing Up', description: 'Reach mass of 200', category: 'growth', progress: 0, target: 200, completed: false },
    { id: 'growth_3', name: 'Big Boy', description: 'Reach mass of 500', category: 'growth', progress: 0, target: 500, completed: false },
    { id: 'growth_4', name: 'Massive', description: 'Reach mass of 1000', category: 'growth', progress: 0, target: 1000, completed: false },
    { id: 'growth_5', name: 'Behemoth', description: 'Reach mass of 2500', category: 'growth', progress: 0, target: 2500, completed: false },
    { id: 'growth_6', name: 'Leviathan', description: 'Reach mass of 5000', category: 'growth', progress: 0, target: 5000, completed: false },
    { id: 'growth_7', name: 'World Serpent', description: 'Reach mass of 10000', category: 'growth', progress: 0, target: 10000, completed: false },

    // Combat category (7 achievements)
    { id: 'combat_1', name: 'First Blood', description: 'Eliminate 1 opponent', category: 'combat', progress: 0, target: 1, completed: false },
    { id: 'combat_2', name: 'Predator', description: 'Eliminate 5 opponents', category: 'combat', progress: 0, target: 5, completed: false },
    { id: 'combat_3', name: 'Hunter', description: 'Eliminate 15 opponents', category: 'combat', progress: 0, target: 15, completed: false },
    { id: 'combat_4', name: 'Slayer', description: 'Eliminate 30 opponents', category: 'combat', progress: 0, target: 30, completed: false },
    { id: 'combat_5', name: 'Dominator', description: 'Eliminate 50 opponents', category: 'combat', progress: 0, target: 50, completed: false },
    { id: 'combat_6', name: 'Annihilator', description: 'Eliminate 100 opponents', category: 'combat', progress: 0, target: 100, completed: false },
    { id: 'combat_7', name: 'Extinction Event', description: 'Eliminate 250 opponents', category: 'combat', progress: 0, target: 250, completed: false },

    // Survival category (6 achievements)
    { id: 'survival_1', name: 'Survivor', description: 'Survive for 60 seconds', category: 'survival', progress: 0, target: 60, completed: false },
    { id: 'survival_2', name: 'Endurance', description: 'Survive for 180 seconds', category: 'survival', progress: 0, target: 180, completed: false },
    { id: 'survival_3', name: 'Marathon', description: 'Survive for 300 seconds', category: 'survival', progress: 0, target: 300, completed: false },
    { id: 'survival_4', name: 'Ironclad', description: 'Survive for 600 seconds', category: 'survival', progress: 0, target: 600, completed: false },
    { id: 'survival_5', name: 'Immortal', description: 'Survive for 900 seconds', category: 'survival', progress: 0, target: 900, completed: false },
    { id: 'survival_6', name: 'Eternal', description: 'Survive for 1800 seconds', category: 'survival', progress: 0, target: 1800, completed: false },

    // Collection category (6 achievements)
    { id: 'collection_1', name: 'Nibbler', description: 'Collect 50 orbs', category: 'collection', progress: 0, target: 50, completed: false },
    { id: 'collection_2', name: 'Gatherer', description: 'Collect 200 orbs', category: 'collection', progress: 0, target: 200, completed: false },
    { id: 'collection_3', name: 'Hoarder', description: 'Collect 500 orbs', category: 'collection', progress: 0, target: 500, completed: false },
    { id: 'collection_4', name: 'Vacuum', description: 'Collect 1000 orbs', category: 'collection', progress: 0, target: 1000, completed: false },
    { id: 'collection_5', name: 'Black Hole', description: 'Collect 2500 orbs', category: 'collection', progress: 0, target: 2500, completed: false },
    { id: 'collection_6', name: 'Cosmic Devourer', description: 'Collect 5000 orbs', category: 'collection', progress: 0, target: 5000, completed: false },

    // Mastery category (6 achievements)
    { id: 'mastery_1', name: 'Apprentice', description: 'Complete 5 achievements', category: 'mastery', progress: 0, target: 5, completed: false },
    { id: 'mastery_2', name: 'Journeyman', description: 'Complete 10 achievements', category: 'mastery', progress: 0, target: 10, completed: false },
    { id: 'mastery_3', name: 'Expert', description: 'Complete 15 achievements', category: 'mastery', progress: 0, target: 15, completed: false },
    { id: 'mastery_4', name: 'Master', description: 'Complete 20 achievements', category: 'mastery', progress: 0, target: 20, completed: false },
    { id: 'mastery_5', name: 'Grandmaster', description: 'Complete 25 achievements', category: 'mastery', progress: 0, target: 25, completed: false },
    { id: 'mastery_6', name: 'Snake King', description: 'Complete all 30 base achievements', category: 'mastery', progress: 0, target: 30, completed: false },
  ];
}

export class AchievementSystem {
  private achievements: Achievement[];
  private notifications: AchievementNotification[] = [];
  private useLocalStorage: boolean = true;
  private unlockedSkins: Set<string> = new Set();

  constructor() {
    this.achievements = this.loadAchievements();
    this.recalculateUnlockedSkins();
  }

  private loadAchievements(): Achievement[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: Achievement[] = JSON.parse(stored);
        // Merge with defaults to pick up any new achievements added after initial save
        const defaults = createDefaultAchievements();
        const storedMap = new Map(parsed.map(a => [a.id, a]));
        return defaults.map(def => storedMap.get(def.id) ?? def);
      }
    } catch (e) {
      console.warn('[AchievementSystem] localStorage unavailable, using in-memory storage.', e);
      this.useLocalStorage = false;
    }
    return createDefaultAchievements();
  }

  private saveAchievements(): void {
    if (!this.useLocalStorage) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.achievements));
    } catch (e) {
      console.warn('[AchievementSystem] Failed to save to localStorage.', e);
      this.useLocalStorage = false;
    }
  }

  private recalculateUnlockedSkins(): void {
    const categories: AchievementCategory[] = ['growth', 'combat', 'survival', 'collection', 'mastery'];
    for (const category of categories) {
      const categoryAchievements = this.achievements.filter(a => a.category === category);
      const allComplete = categoryAchievements.length > 0 && categoryAchievements.every(a => a.completed);
      if (allComplete) {
        this.unlockedSkins.add(CATEGORY_SKIN_REWARDS[category]);
      }
    }
  }

  private checkCategoryCompletion(category: AchievementCategory): void {
    const categoryAchievements = this.achievements.filter(a => a.category === category);
    const allComplete = categoryAchievements.length > 0 && categoryAchievements.every(a => a.completed);
    const skinReward = CATEGORY_SKIN_REWARDS[category];

    if (allComplete && !this.unlockedSkins.has(skinReward)) {
      this.unlockedSkins.add(skinReward);
      this.notifications.push({
        text: `🎨 Category Complete! Unlocked: ${skinReward}`,
        timer: NOTIFICATION_DURATION,
      });
    }
  }

  updateProgress(id: string, value: number): void {
    const achievement = this.achievements.find(a => a.id === id);
    if (!achievement || achievement.completed) return;

    achievement.progress = Math.min(value, achievement.target);

    if (achievement.progress >= achievement.target) {
      achievement.completed = true;
      this.notifications.push({
        text: `🏆 Achievement Unlocked: ${achievement.name}`,
        timer: NOTIFICATION_DURATION,
      });
      this.checkCategoryCompletion(achievement.category);
    }

    this.saveAchievements();
  }

  checkAchievements(stats: AchievementStats): void {
    // Growth achievements - based on max mass reached
    for (const achievement of this.achievements.filter(a => a.category === 'growth' && !a.completed)) {
      if (stats.mass >= achievement.target) {
        this.updateProgress(achievement.id, stats.mass);
      } else {
        achievement.progress = Math.min(stats.mass, achievement.target);
      }
    }

    // Combat achievements - based on total eliminations
    for (const achievement of this.achievements.filter(a => a.category === 'combat' && !a.completed)) {
      if (stats.eliminations >= achievement.target) {
        this.updateProgress(achievement.id, stats.eliminations);
      } else {
        achievement.progress = stats.eliminations;
      }
    }

    // Survival achievements - based on survival time in seconds
    for (const achievement of this.achievements.filter(a => a.category === 'survival' && !a.completed)) {
      if (stats.survivalTime >= achievement.target) {
        this.updateProgress(achievement.id, stats.survivalTime);
      } else {
        achievement.progress = stats.survivalTime;
      }
    }

    // Collection achievements - based on orbs collected
    for (const achievement of this.achievements.filter(a => a.category === 'collection' && !a.completed)) {
      if (stats.orbsCollected >= achievement.target) {
        this.updateProgress(achievement.id, stats.orbsCollected);
      } else {
        achievement.progress = stats.orbsCollected;
      }
    }

    // Mastery achievements - based on total completed count
    const completedCount = this.getCompletedCount();
    for (const achievement of this.achievements.filter(a => a.category === 'mastery' && !a.completed)) {
      if (completedCount >= achievement.target) {
        this.updateProgress(achievement.id, completedCount);
      } else {
        achievement.progress = completedCount;
      }
    }

    this.saveAchievements();
  }

  renderNotifications(ctx: CanvasRenderingContext2D): void {
    if (this.notifications.length === 0) return;

    const canvasWidth = ctx.canvas.width;
    const bannerHeight = 50;
    const padding = 10;
    let yOffset = 10;

    for (let i = this.notifications.length - 1; i >= 0; i--) {
      const notification = this.notifications[i];

      // Calculate fade-out alpha for last second
      const alpha = notification.timer < 1000 ? notification.timer / 1000 : 1;

      // Banner background
      ctx.save();
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = '#1a1a2e';
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;

      const bannerWidth = 400;
      const x = (canvasWidth - bannerWidth) / 2;

      // Rounded rectangle
      const radius = 8;
      ctx.beginPath();
      ctx.moveTo(x + radius, yOffset);
      ctx.lineTo(x + bannerWidth - radius, yOffset);
      ctx.quadraticCurveTo(x + bannerWidth, yOffset, x + bannerWidth, yOffset + radius);
      ctx.lineTo(x + bannerWidth, yOffset + bannerHeight - radius);
      ctx.quadraticCurveTo(x + bannerWidth, yOffset + bannerHeight, x + bannerWidth - radius, yOffset + bannerHeight);
      ctx.lineTo(x + radius, yOffset + bannerHeight);
      ctx.quadraticCurveTo(x, yOffset + bannerHeight, x, yOffset + bannerHeight - radius);
      ctx.lineTo(x, yOffset + radius);
      ctx.quadraticCurveTo(x, yOffset, x + radius, yOffset);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Text
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(notification.text, canvasWidth / 2, yOffset + bannerHeight / 2);
      ctx.restore();

      yOffset += bannerHeight + padding;
    }
  }

  /**
   * Called each frame with deltaTime in milliseconds to update notification timers.
   */
  update(deltaTime: number): void {
    for (let i = this.notifications.length - 1; i >= 0; i--) {
      this.notifications[i].timer -= deltaTime;
      if (this.notifications[i].timer <= 0) {
        this.notifications.splice(i, 1);
      }
    }
  }

  getAchievements(): Achievement[] {
    return [...this.achievements];
  }

  getCompletedCount(): number {
    return this.achievements.filter(a => a.completed).length;
  }

  getUnlockedSkins(): string[] {
    return [...this.unlockedSkins];
  }

  getCategoryProgress(category: AchievementCategory): { completed: number; total: number } {
    const categoryAchievements = this.achievements.filter(a => a.category === category);
    return {
      completed: categoryAchievements.filter(a => a.completed).length,
      total: categoryAchievements.length,
    };
  }
}
