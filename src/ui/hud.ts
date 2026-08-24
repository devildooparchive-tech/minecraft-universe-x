/**
 * HUD — survival bars + hotbar. Thin DOM layer over game state.
 *
 * Uses dependency injection of getters so tests can drive it without
 * the real game loop.
 */

export interface HudState {
  health: number; // 0..20 (10 hearts × 2)
  maxHealth: number;
  hunger: number; // 0..20 (10 drumsticks × 2)
  air: number; // seconds remaining underwater
  airMax: number;
  selectedSlot: number;
  slots: Array<{ id: number; count: number } | null>;
}

export interface HudElements {
  hearts: HTMLElement;
  hunger: HTMLElement;
  air: HTMLElement;
  hotbar: HTMLElement;
}

function heartChar(fill: 'full' | 'half' | 'empty'): string {
  return fill === 'full' ? '❤' : fill === 'half' ? '♥' : '♡';
}

export function renderHud(state: HudState, el: HudElements): void {
  // hearts: each heart = 2 HP, half-heart = odd point
  let hearts = '';
  for (let i = 0; i < state.maxHealth / 2; i++) {
    const hp = state.health - i * 2;
    hearts += hp >= 2 ? heartChar('full') : hp === 1 ? heartChar('half') : heartChar('empty');
  }
  el.hearts.textContent = hearts;

  // hunger: 🍗 full / half ▚ / empty
  let food = '';
  for (let i = 0; i < 10; i++) {
    const pts = state.hunger - i * 2;
    food += pts >= 2 ? '🍗' : pts === 1 ? '🍖' : '·';
  }
  el.hunger.textContent = food;

  // air bubbles only when not at max
  if (state.air >= state.airMax) {
    el.air.textContent = '';
  } else {
    const bubbles = Math.ceil((state.air / state.airMax) * 10);
    el.air.textContent = '🫧'.repeat(bubbles);
  }

  // hotbar: 9 cells, active highlighted, shows block glyph + count
  const GLYPHS: Record<number, string> = {
    1: '🟩', 2: '🟫', 3: '⬜', 4: '🟨', 5: '💧', 6: '🪵',
    7: '🍃', 9: '❄️', 10: '⬛', 11: '💡', 12: '⚫', 13: '🟠', 14: '🟡', 15: '💎',
  };
  let html = '';
  for (let i = 0; i < 9; i++) {
    const s = state.slots[i];
    const active = i === state.selectedSlot;
    const glyph = s ? GLYPHS[s.id] ?? '▪️' : '&nbsp;';
    const count = s && s.count > 1 ? s.count : '';
    html += `<div class="slot${active ? ' active' : ''}" data-slot="${i}"><span class="glyph">${glyph}</span><span class="count">${count}</span></div>`;
  }
  el.hotbar.innerHTML = html;
}
