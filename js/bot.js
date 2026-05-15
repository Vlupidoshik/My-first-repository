// bot.js
// Простая логика поведения бота по уровням.
(function (global) {
  // Чем выше уровень, тем дольше бот рискует в текущем ходу.
  function getBotTarget(level) {
    return 300 + (level - 1) * 80;
  }

  function shouldBotRoll(turnScore, level) {
    const target = getBotTarget(level);
    return turnScore < target;
  }

  global.ZonkBot = {
    getBotTarget,
    shouldBotRoll
  };
})(window);
