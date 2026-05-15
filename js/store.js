// store.js
// Модуль сохранения прогресса и логики магазина.
(function (global) {
  const SAVE_KEY = 'zonk_save_v1';

  const defaultState = {
    level: 1,
    playerScore: 0,
    botScore: 0,
    coins: 0,
    inventory: {
      hints: 0,
      extraRolls: 0,
      cosmeticBlue: 0
    }
  };

  const items = [
    { id: 'hints', name: 'Подсказка', cost: 50, desc: 'Показывает, стоит ли рисковать.' },
    { id: 'extraRolls', name: 'Доп. бросок', cost: 75, desc: '+1 шанс переброса в ходу.' },
    { id: 'cosmeticBlue', name: 'Синие кости', cost: 120, desc: 'Косметика для костей.' }
  ];

  function loadState() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return structuredClone(defaultState);
      const parsed = JSON.parse(raw);
      return {
        ...structuredClone(defaultState),
        ...parsed,
        inventory: { ...structuredClone(defaultState).inventory, ...(parsed.inventory || {}) }
      };
    } catch (e) {
      console.warn('Ошибка загрузки сохранения:', e);
      return structuredClone(defaultState);
    }
  }

  function saveState(state) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  function resetState() {
    localStorage.removeItem(SAVE_KEY);
    return structuredClone(defaultState);
  }

  function canBuy(state, itemId) {
    const item = items.find((i) => i.id === itemId);
    return !!item && state.coins >= item.cost;
  }

  function buy(state, itemId) {
    const item = items.find((i) => i.id === itemId);
    if (!item || state.coins < item.cost) return false;
    state.coins -= item.cost;
    state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
    saveState(state);
    return true;
  }

  global.ZonkStore = {
    SAVE_KEY,
    items,
    loadState,
    saveState,
    resetState,
    canBuy,
    buy
  };
})(window);
