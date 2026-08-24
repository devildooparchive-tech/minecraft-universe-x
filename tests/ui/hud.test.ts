import { describe, it, expect, beforeEach } from 'vitest';
import { renderHud, type HudState } from '../../src/ui/hud';

function makeEl(): Record<string, HTMLElement> {
  // minimal DOM stand-ins (textContent/innerHTML assignable)
  const mk = (): HTMLElement => ({ textContent: '', innerHTML: '' }) as unknown as HTMLElement;
  return { hearts: mk(), hunger: mk(), air: mk(), hotbar: mk() };
}

const baseState = (): HudState => ({
  health: 20,
  maxHealth: 20,
  hunger: 20,
  air: 900,
  airMax: 900,
  selectedSlot: 0,
  slots: new Array(9).fill(null),
});

describe('HUD rendering', () => {
  let el: ReturnType<typeof makeEl>;

  beforeEach(() => {
    el = makeEl();
  });

  it('full health renders 10 full hearts', () => {
    renderHud(baseState(), el as never);
    expect(el.hearts.textContent).toBe('❤'.repeat(10));
  });

  it('odd health renders a half heart in the right position', () => {
    const st = baseState();
    st.health = 15; // 7 full + 1 half + 2 empty
    renderHud(st, el as never);
    expect(el.hearts.textContent).toBe('❤'.repeat(7) + '♥' + '♡'.repeat(2));
  });

  it('low health renders mostly empty hearts', () => {
    const st = baseState();
    st.health = 3; // 1 full + 1 half + 8 empty
    renderHud(st, el as never);
    expect(el.hearts.textContent).toBe('❤♥' + '♡'.repeat(8));
  });

  it('hunger mirrors the same pattern', () => {
    const st = baseState();
    st.hunger = 17; // 8 full + 1 half + 1 empty
    renderHud(st, el as never);
    expect(el.hunger.textContent).toBe('🍗'.repeat(8) + '🍖' + '·');
  });

  it('air bubbles appear only when submerged', () => {
    const st = baseState();
    st.air = 450;
    st.airMax = 900;
    renderHud(st, el as never);
    expect(el.air.textContent).toContain('🫧');
    // surfaced → no bubbles
    const st2 = baseState();
    renderHud(st2, el as never);
    expect(el.air.textContent).toBe('');
  });

  it('hotbar highlights the selected slot and shows counts', () => {
    const st = baseState();
    st.slots[0] = { id: 3, count: 64 };
    st.slots[1] = { id: 6, count: 3 };
    st.selectedSlot = 1;
    renderHud(st, el as never);
    expect(el.hotbar.innerHTML).toContain('class="slot active" data-slot="1"');
    expect(el.hotbar.innerHTML).not.toContain('data-slot="0" class');
    expect(el.hotbar.innerHTML).toContain('>64<'); // stone count shown
    expect(el.hotbar.innerHTML).toContain('>3<'); // wood count shown
  });
});
