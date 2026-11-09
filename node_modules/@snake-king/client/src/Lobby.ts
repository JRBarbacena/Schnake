/**
 * Lobby UI — Game mode selection, player name input, matchmaking trigger,
 * live stats (online players, active sessions), and daily challenge card.
 */

interface DailyChallenge {
  objective: string;
  reward: string;
  endsAt: number; // epoch ms
}

export class Lobby {
  private container: HTMLDivElement;
  private playerName: string;
  private selectedMode: string = 'classic';
  private onPlay: (name: string, mode: string) => void;

  private nameInput!: HTMLInputElement;
  private playButton!: HTMLButtonElement;
  private modeButtons: HTMLButtonElement[] = [];
  private playerCountEl!: HTMLSpanElement;
  private sessionCountEl!: HTMLSpanElement;
  private challengeCard!: HTMLDivElement;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private statsInterval: ReturnType<typeof setInterval> | null = null;

  private static readonly MODES = [
    { id: 'classic', label: 'Classic' },
    { id: 'battle-royale', label: 'Battle Royale' },
    { id: 'team', label: 'Team' },
    { id: 'infinite-growth', label: 'Infinite Growth' },
  ];

  constructor(parent: HTMLElement, onPlay: (name: string, mode: string) => void) {
    this.onPlay = onPlay;
    this.playerName = localStorage.getItem('snakeking_playerName') || '';
    const savedMode = localStorage.getItem('snakeking_selectedMode');
    if (savedMode) {
      this.selectedMode = savedMode;
    }

    this.container = document.createElement('div');
    this.container.className = 'lobby-container';
    this.container.style.display = 'none';
    parent.appendChild(this.container);

    this.buildUI();
  }

  show(): void {
    this.container.style.display = 'flex';
    this.startStatsPolling();
  }

  hide(): void {
    this.container.style.display = 'none';
    this.stopStatsPolling();
    this.stopCountdown();
  }

  updateStats(sessionCount: number, playerCount: number): void {
    this.sessionCountEl.textContent = String(sessionCount);
    this.playerCountEl.textContent = String(playerCount);
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private buildUI(): void {
    // Title
    const title = document.createElement('h1');
    title.textContent = "Who's the Snake King";
    title.className = 'lobby-title';
    this.container.appendChild(title);

    // Player name input
    const nameSection = document.createElement('div');
    nameSection.className = 'lobby-name-section';
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Player Name';
    nameLabel.setAttribute('for', 'lobby-name-input');
    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.id = 'lobby-name-input';
    this.nameInput.className = 'lobby-name-input';
    this.nameInput.placeholder = 'Enter your name...';
    this.nameInput.maxLength = 20;
    this.nameInput.value = this.playerName;
    this.nameInput.addEventListener('input', () => {
      this.playerName = this.nameInput.value.trim();
      localStorage.setItem('snakeking_playerName', this.playerName);
      this.updatePlayButtonState();
    });
    nameSection.appendChild(nameLabel);
    nameSection.appendChild(this.nameInput);
    this.container.appendChild(nameSection);

    // Mode selection
    const modeSection = document.createElement('div');
    modeSection.className = 'lobby-mode-section';
    const modeLabel = document.createElement('h3');
    modeLabel.textContent = 'Select Game Mode';
    modeSection.appendChild(modeLabel);

    const modeGrid = document.createElement('div');
    modeGrid.className = 'lobby-mode-grid';

    for (const mode of Lobby.MODES) {
      const btn = document.createElement('button');
      btn.className = 'lobby-mode-btn';
      btn.textContent = mode.label;
      btn.dataset.mode = mode.id;
      if (mode.id === this.selectedMode) {
        btn.classList.add('selected');
      }
      btn.addEventListener('click', () => this.selectMode(mode.id));
      modeGrid.appendChild(btn);
      this.modeButtons.push(btn);
    }

    modeSection.appendChild(modeGrid);
    this.container.appendChild(modeSection);

    // Play button
    this.playButton = document.createElement('button');
    this.playButton.className = 'lobby-play-btn';
    this.playButton.textContent = 'Play';
    this.playButton.addEventListener('click', () => this.handlePlay());
    this.updatePlayButtonState();
    this.container.appendChild(this.playButton);

    // Stats section
    const statsSection = document.createElement('div');
    statsSection.className = 'lobby-stats-section';
    const playersLabel = document.createElement('span');
    playersLabel.textContent = 'Players Online: ';
    this.playerCountEl = document.createElement('span');
    this.playerCountEl.className = 'lobby-stat-value';
    this.playerCountEl.textContent = '0';
    const sessionsLabel = document.createElement('span');
    sessionsLabel.textContent = ' | Active Sessions: ';
    this.sessionCountEl = document.createElement('span');
    this.sessionCountEl.className = 'lobby-stat-value';
    this.sessionCountEl.textContent = '0';
    statsSection.appendChild(playersLabel);
    statsSection.appendChild(this.playerCountEl);
    statsSection.appendChild(sessionsLabel);
    statsSection.appendChild(this.sessionCountEl);
    this.container.appendChild(statsSection);

    // Daily challenge card
    this.challengeCard = document.createElement('div');
    this.challengeCard.className = 'lobby-challenge-card';
    this.container.appendChild(this.challengeCard);
    this.renderDailyChallenge();
  }

  private selectMode(modeId: string): void {
    this.selectedMode = modeId;
    localStorage.setItem('snakeking_selectedMode', modeId);
    for (const btn of this.modeButtons) {
      btn.classList.toggle('selected', btn.dataset.mode === modeId);
    }
  }

  private handlePlay(): void {
    if (!this.playerName) return;
    this.onPlay(this.playerName, this.selectedMode);
  }

  private updatePlayButtonState(): void {
    this.playButton.disabled = !this.playerName;
  }

  private startStatsPolling(): void {
    this.stopStatsPolling();
    this.statsInterval = setInterval(() => {
      // Emit a custom event that the networking layer can listen to
      this.container.dispatchEvent(
        new CustomEvent('lobby:requestStats', { bubbles: true })
      );
    }, 5000);
  }

  private stopStatsPolling(): void {
    if (this.statsInterval !== null) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  // ------------------------------------------------------------------
  // Daily challenge
  // ------------------------------------------------------------------

  private renderDailyChallenge(): void {
    const challenge = this.getDailyChallenge();
    this.challengeCard.innerHTML = '';

    const heading = document.createElement('h3');
    heading.textContent = 'Daily Challenge';
    this.challengeCard.appendChild(heading);

    const objective = document.createElement('p');
    objective.className = 'challenge-objective';
    objective.textContent = `Objective: ${challenge.objective}`;
    this.challengeCard.appendChild(objective);

    const reward = document.createElement('p');
    reward.className = 'challenge-reward';
    reward.textContent = `Reward: ${challenge.reward}`;
    this.challengeCard.appendChild(reward);

    const countdown = document.createElement('p');
    countdown.className = 'challenge-countdown';
    this.challengeCard.appendChild(countdown);

    this.startCountdown(challenge.endsAt, countdown);
  }

  private getDailyChallenge(): DailyChallenge {
    // Rotate challenges based on day of year
    const challenges: DailyChallenge[] = [
      { objective: 'Reach length 100 without boosting', reward: 'Golden Skin', endsAt: this.getEndOfDay() },
      { objective: 'Eliminate 5 snakes in one session', reward: 'Flame Trail', endsAt: this.getEndOfDay() },
      { objective: 'Survive for 10 minutes', reward: 'Diamond Crown', endsAt: this.getEndOfDay() },
      { objective: 'Collect 50 orbs in under 2 minutes', reward: 'Lightning Pattern', endsAt: this.getEndOfDay() },
      { objective: 'Win a Battle Royale match', reward: 'Royal Skin', endsAt: this.getEndOfDay() },
      { objective: 'Reach #1 on the leaderboard', reward: 'Sparkle Trail', endsAt: this.getEndOfDay() },
      { objective: 'Grow to 200 length in Team mode', reward: 'Neon Stripes', endsAt: this.getEndOfDay() },
    ];

    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    return challenges[dayOfYear % challenges.length];
  }

  private getEndOfDay(): number {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  }

  private startCountdown(endsAt: number, element: HTMLElement): void {
    this.stopCountdown();
    const update = () => {
      const remaining = Math.max(0, endsAt - Date.now());
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      element.textContent = `Time Left: ${hours}h ${minutes}m ${seconds}s`;
    };
    update();
    this.countdownInterval = setInterval(update, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownInterval !== null) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }
}
