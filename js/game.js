// game.js
// Основная логика игры «Зонк» на Phaser 3.

(function () {
  const WIDTH = 960;
  const HEIGHT = 540;
  const TARGET_TOTAL = 5000;

  // Заглушка рекламы: позже можно заменить вызовами Яндекс SDK.
  function showAd(callback) {
    console.log('Показ рекламы (заглушка)...');
    setTimeout(() => {
      console.log('Реклама завершена');
      callback && callback();
    }, 1200);
  }

  function scoreRoll(values) {
    const counts = Array(7).fill(0);
    values.forEach((v) => counts[v]++);

    let points = 0;
    for (let n = 1; n <= 6; n++) {
      if (counts[n] >= 3) {
        points += (n === 1 ? 1000 : n * 100);
        counts[n] -= 3;
      }
    }
    points += counts[1] * 100;
    points += counts[5] * 50;
    return points;
  }

  class MainScene extends Phaser.Scene {
    constructor() {
      super('MainScene');
      this.state = ZonkStore.loadState();
      this.turnScore = 0;
      this.isPlayerTurn = true;
      this.botTurnScore = 0;
      this.currentDiceValues = [1, 1, 1, 1, 1, 1];
      this.extraRollsUsed = 0;
      this.secondLifeAvailable = false;
    }

    create() {
      this.createBackground();
      this.createUI();
      this.showStartScreen();
    }

    createBackground() {
      this.add.image(WIDTH / 2, HEIGHT / 2, 'bg').setDisplaySize(WIDTH, HEIGHT);
    }

    createUI() {
      this.playerText = this.add.text(20, 20, '', { fontSize: '24px', color: '#ffffff' });
      this.botText = this.add.text(20, 55, '', { fontSize: '24px', color: '#ffffff' });
      this.levelText = this.add.text(20, 90, '', { fontSize: '22px', color: '#a5f3fc' });
      this.turnText = this.add.text(20, 125, '', { fontSize: '20px', color: '#fde68a' });

      this.statusText = this.add.text(WIDTH / 2, 30, '', {
        fontSize: '22px', color: '#ffffff'
      }).setOrigin(0.5, 0);

      this.diceSprites = [];
      for (let i = 0; i < 6; i++) {
        const x = 170 + i * 120;
        const y = HEIGHT / 2;
        const sprite = this.add.image(x, y, 'die1').setDisplaySize(90, 90);
        this.diceSprites.push(sprite);
      }

      this.rollBtn = this.makeButton(220, HEIGHT - 80, 'Бросить', () => this.playerRoll());
      this.stopBtn = this.makeButton(420, HEIGHT - 80, 'Стоп', () => this.playerStop());
      this.shopBtn = this.makeButton(620, HEIGHT - 80, 'Магазин', () => this.openShop());

      this.hintText = this.add.text(WIDTH - 20, 20, '', {
        fontSize: '18px', color: '#93c5fd', align: 'right'
      }).setOrigin(1, 0);

      this.updateHUD();
    }

    makeButton(x, y, label, onClick) {
      const btn = this.add.image(x, y, 'btn').setDisplaySize(170, 56).setInteractive({ useHandCursor: true });
      const text = this.add.text(x, y, label, { fontSize: '24px', color: '#0f172a' }).setOrigin(0.5);
      btn.on('pointerdown', () => {
        this.tweens.add({ targets: btn, scaleX: 0.95, scaleY: 0.95, yoyo: true, duration: 80 });
        onClick();
      });
      return { btn, text, setVisible: (v) => { btn.setVisible(v); text.setVisible(v); } };
    }

    showStartScreen() {
      this.overlay = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.6);
      this.panel = this.add.rectangle(WIDTH / 2, HEIGHT / 2, 500, 280, 0x1e293b, 0.95).setStrokeStyle(2, 0x38bdf8);
      this.title = this.add.text(WIDTH / 2, HEIGHT / 2 - 70, 'ЗОНК', { fontSize: '64px', color: '#e2e8f0' }).setOrigin(0.5);
      const start = this.makeButton(WIDTH / 2, HEIGHT / 2 + 40, 'Играть', () => {
        [this.overlay, this.panel, this.title, start.btn, start.text].forEach((o) => o.destroy());
        this.startRound();
      });
    }

    startRound() {
      this.turnScore = 0;
      this.extraRollsUsed = 0;
      this.isPlayerTurn = true;
      this.statusText.setText('Ваш ход');
      this.updateHint();
      this.updateHUD();
    }

    updateHUD() {
      this.playerText.setText(`Игрок: ${this.state.playerScore}`);
      this.botText.setText(`Бот: ${this.state.botScore}`);
      this.levelText.setText(`Уровень: ${this.state.level}`);
      this.turnText.setText(`Очки хода: ${this.turnScore}`);
    }

    updateHint() {
      const target = ZonkBot.getBotTarget(this.state.level);
      this.hintText.setText(`Подсказка: цель бота ${target}\nМонеты: ${this.state.coins}`);
    }

    animateDice(onDone) {
      let done = 0;
      this.diceSprites.forEach((die, i) => {
        this.tweens.add({
          targets: die,
          y: die.y - 20,
          angle: 360,
          duration: 250,
          yoyo: true,
          onUpdate: () => {
            const value = Phaser.Math.Between(1, 6);
            die.setTexture(`die${value}`);
            this.currentDiceValues[i] = value;
          },
          onComplete: () => {
            done++;
            if (done === this.diceSprites.length && onDone) onDone();
          }
        });
      });
    }

    playerRoll() {
      if (!this.isPlayerTurn) return;
      this.animateDice(() => {
        const points = scoreRoll(this.currentDiceValues);
        if (points === 0) {
          if (!this.secondLifeAvailable) {
            this.statusText.setText('Зонк! Очки хода потеряны.');
            this.turnScore = 0;
            this.updateHUD();
            this.nextTurnBot();
          } else {
            this.secondLifeAvailable = false;
            this.statusText.setText('Вторая жизнь спасла бросок!');
          }
          return;
        }

        this.turnScore += points;
        this.animateCounter(this.turnText, 'Очки хода: ', this.turnScore - points, this.turnScore);
        this.updateHint();

        if (this.state.inventory.hints > 0 && this.turnScore > 0) {
          const recommendRoll = this.turnScore < ZonkBot.getBotTarget(this.state.level);
          this.statusText.setText(`Подсказка: ${recommendRoll ? 'можно рискнуть' : 'лучше стоп'}`);
        }
      });
    }

    playerStop() {
      if (!this.isPlayerTurn) return;
      this.state.playerScore += this.turnScore;
      this.state.coins += Math.floor(this.turnScore / 10);
      this.turnScore = 0;
      this.updateHUD();
      ZonkStore.saveState(this.state);

      if (this.state.playerScore >= TARGET_TOTAL) {
        this.showLevelComplete();
        return;
      }
      this.nextTurnBot();
    }

    nextTurnBot() {
      this.isPlayerTurn = false;
      this.statusText.setText('Ход бота...');
      this.botTurnScore = 0;
      const loop = () => {
        this.animateDice(() => {
          const points = scoreRoll(this.currentDiceValues);
          if (points === 0) {
            this.botTurnScore = 0;
            this.statusText.setText('Бот зазонкался!');
            this.time.delayedCall(900, () => this.endBotTurn());
            return;
          }
          this.botTurnScore += points;
          const shouldRoll = ZonkBot.shouldBotRoll(this.botTurnScore, this.state.level);
          if (shouldRoll) this.time.delayedCall(700, loop);
          else this.time.delayedCall(700, () => this.endBotTurn());
        });
      };
      this.time.delayedCall(500, loop);
    }

    endBotTurn() {
      this.state.botScore += this.botTurnScore;
      this.updateHUD();
      ZonkStore.saveState(this.state);
      if (this.state.botScore >= TARGET_TOTAL) {
        this.showGameOver();
      } else {
        this.isPlayerTurn = true;
        this.turnScore = 0;
        this.statusText.setText('Ваш ход');
        this.updateHUD();
      }
    }

    showLevelComplete() {
      this.state.level += 1;
      this.state.playerScore = 0;
      this.state.botScore = 0;
      ZonkStore.saveState(this.state);

      const ov = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.65);
      const p = this.add.rectangle(WIDTH / 2, HEIGHT / 2, 560, 320, 0x1f2937, 0.95).setStrokeStyle(2, 0x4ade80);
      const t = this.add.text(WIDTH / 2, HEIGHT / 2 - 90, 'Уровень пройден!', { fontSize: '42px', color: '#bbf7d0' }).setOrigin(0.5);
      const adBtn = this.makeButton(WIDTH / 2, HEIGHT / 2 - 10, 'Смотреть рекламу', () => {
        showAd(() => {
          this.secondLifeAvailable = true;
          this.statusText.setText('Получена вторая жизнь!');
        });
      });
      const nextBtn = this.makeButton(WIDTH / 2, HEIGHT / 2 + 90, 'Далее', () => {
        [ov, p, t, adBtn.btn, adBtn.text, nextBtn.btn, nextBtn.text].forEach((o) => o.destroy());
        this.startRound();
      });
    }

    showGameOver() {
      const ov = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.7);
      const p = this.add.rectangle(WIDTH / 2, HEIGHT / 2, 540, 300, 0x111827, 0.95).setStrokeStyle(2, 0xf87171);
      const t = this.add.text(WIDTH / 2, HEIGHT / 2 - 70, 'Game Over', { fontSize: '56px', color: '#fecaca' }).setOrigin(0.5);
      const s = this.add.text(WIDTH / 2, HEIGHT / 2 - 10, `Счёт бота: ${this.state.botScore}`, { fontSize: '26px', color: '#e5e7eb' }).setOrigin(0.5);
      const restart = this.makeButton(WIDTH / 2, HEIGHT / 2 + 80, 'Сначала', () => {
        this.state = ZonkStore.resetState();
        [ov, p, t, s, restart.btn, restart.text].forEach((o) => o.destroy());
        this.updateHUD();
        this.showStartScreen();
      });
    }

    openShop() {
      const ov = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.6);
      const p = this.add.rectangle(WIDTH / 2, HEIGHT / 2, 700, 400, 0x0b1220, 0.98).setStrokeStyle(2, 0x38bdf8);
      const title = this.add.text(WIDTH / 2, HEIGHT / 2 - 160, `Магазин (монеты: ${this.state.coins})`, { fontSize: '30px', color: '#dbeafe' }).setOrigin(0.5);

      const temp = [ov, p, title];
      ZonkStore.items.forEach((item, idx) => {
        const y = HEIGHT / 2 - 80 + idx * 90;
        const text = this.add.text(180, y, `${item.name} — ${item.cost}\n${item.desc}`, { fontSize: '20px', color: '#e5e7eb' });
        const buy = this.makeButton(700, y + 18, 'Купить', () => {
          const ok = ZonkStore.buy(this.state, item.id);
          title.setText(`Магазин (монеты: ${this.state.coins})`);
          this.statusText.setText(ok ? `Куплено: ${item.name}` : 'Недостаточно монет');
          this.updateHint();
        });
        temp.push(text, buy.btn, buy.text);
      });

      const close = this.makeButton(WIDTH / 2, HEIGHT / 2 + 160, 'Закрыть', () => {
        temp.concat([close.btn, close.text]).forEach((o) => o.destroy());
      });
    }

    animateCounter(textObj, prefix, from, to) {
      const holder = { value: from };
      this.tweens.add({
        targets: holder,
        value: to,
        duration: 400,
        onUpdate: () => textObj.setText(prefix + Math.floor(holder.value))
      });
    }
  }

  class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    preload() {
      for (let i = 1; i <= 6; i++) this.load.image(`die${i}`, `assets/die${i}.svg`);
      this.load.image('btn', 'assets/button.svg');
      this.load.image('bg', 'assets/bg.svg');
    }
    create() { this.scene.start('MainScene'); }
  }

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-container',
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: '#0f172a',
    scene: [BootScene, MainScene]
  });
})();
