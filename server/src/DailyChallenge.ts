/**
 * Daily Challenge System (Server Side) for "Who's the Snake King"
 * Generates a new challenge at 00:00 UTC daily from a pool of 10+ objectives.
 */

export type ChallengeType = 'mass' | 'eliminations' | 'orbs' | 'survival' | 'evolution';

export interface DailyChallengeConfig {
  id: string;
  objective: string;
  targetValue: number;
  type: ChallengeType;
  reward: string;
}

interface ChallengeTemplate {
  type: ChallengeType;
  objectiveTemplate: string;
  minTarget: number;
  maxTarget: number;
  step: number;
  rewards: string[];
}

const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    type: 'mass',
    objectiveTemplate: 'Reach a mass of {target}',
    minTarget: 200,
    maxTarget: 2000,
    step: 100,
    rewards: ['Golden Trail Effect', 'Mass Boost Token'],
  },
  {
    type: 'mass',
    objectiveTemplate: 'Accumulate a total mass of {target} across all games',
    minTarget: 1000,
    maxTarget: 5000,
    step: 500,
    rewards: ['Glowing Aura', 'Double XP Token'],
  },
  {
    type: 'eliminations',
    objectiveTemplate: 'Eliminate {target} opponents',
    minTarget: 3,
    maxTarget: 15,
    step: 1,
    rewards: ['Flame Trail', 'Predator Badge'],
  },
  {
    type: 'eliminations',
    objectiveTemplate: 'Get {target} eliminations in a single game',
    minTarget: 2,
    maxTarget: 8,
    step: 1,
    rewards: ['Lightning Skin', 'Combat Medal'],
  },
  {
    type: 'orbs',
    objectiveTemplate: 'Collect {target} orbs',
    minTarget: 100,
    maxTarget: 1000,
    step: 50,
    rewards: ['Rainbow Trail', 'Orb Magnet Boost'],
  },
  {
    type: 'orbs',
    objectiveTemplate: 'Collect {target} orbs without dying',
    minTarget: 50,
    maxTarget: 500,
    step: 50,
    rewards: ['Starfield Skin', 'Lucky Charm'],
  },
  {
    type: 'survival',
    objectiveTemplate: 'Survive for {target} seconds in a single game',
    minTarget: 120,
    maxTarget: 600,
    step: 60,
    rewards: ['Shadow Cloak Skin', 'Survival Badge'],
  },
  {
    type: 'survival',
    objectiveTemplate: 'Survive a total of {target} seconds across all games',
    minTarget: 300,
    maxTarget: 1800,
    step: 300,
    rewards: ['Phantom Trail', 'Endurance Medal'],
  },
  {
    type: 'evolution',
    objectiveTemplate: 'Evolve {target} times',
    minTarget: 1,
    maxTarget: 5,
    step: 1,
    rewards: ['Prismatic Skin', 'Evolution Crystal'],
  },
  {
    type: 'evolution',
    objectiveTemplate: 'Reach evolution stage {target}',
    minTarget: 2,
    maxTarget: 5,
    step: 1,
    rewards: ['Dragon Skin', 'Ascension Badge'],
  },
  {
    type: 'mass',
    objectiveTemplate: 'Be the largest snake with mass over {target}',
    minTarget: 500,
    maxTarget: 3000,
    step: 250,
    rewards: ['Crown Effect', 'King Badge'],
  },
  {
    type: 'orbs',
    objectiveTemplate: 'Collect {target} special orbs',
    minTarget: 10,
    maxTarget: 50,
    step: 5,
    rewards: ['Neon Glow Skin', 'Treasure Hunter Badge'],
  },
];

/**
 * Seeded pseudo-random number generator for deterministic daily challenges.
 * Uses a simple mulberry32 algorithm.
 */
function seededRandom(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getDateSeed(date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  return year * 10000 + month * 100 + day;
}

export class DailyChallengeGenerator {
  private currentChallenge: DailyChallengeConfig | null = null;
  private currentDate: string = '';

  generateChallenge(date: Date): DailyChallengeConfig {
    const seed = getDateSeed(date);
    const rng = seededRandom(seed);

    // Select a template deterministically
    const templateIndex = Math.floor(rng() * CHALLENGE_TEMPLATES.length);
    const template = CHALLENGE_TEMPLATES[templateIndex];

    // Determine target value within range
    const steps = Math.floor((template.maxTarget - template.minTarget) / template.step);
    const selectedStep = Math.floor(rng() * (steps + 1));
    const targetValue = template.minTarget + selectedStep * template.step;

    // Select reward
    const rewardIndex = Math.floor(rng() * template.rewards.length);
    const reward = template.rewards[rewardIndex];

    // Build objective string
    const objective = template.objectiveTemplate.replace('{target}', targetValue.toString());

    // Generate a unique ID based on date
    const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    const id = `daily-${dateStr}`;

    const challenge: DailyChallengeConfig = {
      id,
      objective,
      targetValue,
      type: template.type,
      reward,
    };

    this.currentChallenge = challenge;
    this.currentDate = dateStr;

    return challenge;
  }

  getCurrentChallenge(): DailyChallengeConfig {
    const now = new Date();
    const dateStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;

    // Regenerate if the date has changed or no challenge exists
    if (!this.currentChallenge || this.currentDate !== dateStr) {
      this.generateChallenge(now);
    }

    return this.currentChallenge!;
  }

  /**
   * Returns the milliseconds remaining until the next challenge (00:00 UTC).
   */
  getTimeUntilNextChallenge(): number {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 0, 0, 0
    ));
    return tomorrow.getTime() - now.getTime();
  }
}
