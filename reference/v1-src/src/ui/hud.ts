import { gameEvents } from '../core/events';
import { Player } from '../player/player';

export class HUD {
  private healthEl = document.getElementById('health-bar')!;
  private hotbarEl = document.getElementById('hotbar')!;
  private promptEl = document.getElementById('interaction-prompt')!;
  private currentSlot = 0;
  private unsubscribeFns: (() => void)[] = [];

  constructor(private player: Player) {
    this.buildHotbar();
    this.unsubscribeFns.push(gameEvents.on('hotbar-updated', (slot: number) => this.updateHotbar(slot)));
    this.unsubscribeFns.push(gameEvents.on('inventory-updated', () => this.updateHotbar(this.currentSlot)));
  }

  private buildHotbar() {
    this.hotbarEl.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';
      slot.dataset.index = i.toString();
      slot.addEventListener('click', () => {
        this.currentSlot = i;
        gameEvents.emit('hotbar-selected', i);
        this.updateHotbar(i);
      });
      this.hotbarEl.appendChild(slot);
    }
    this.updateHotbar(0);
  }

  updateHotbar(active: number) {
    this.currentSlot = active;
    const slots = this.hotbarEl.children;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i] as HTMLElement;
      slot.classList.toggle('active', i === active);
      const info = this.player.getInventoryInfo(i);
      if (info && info.count > 0) {
        slot.innerHTML = `<span class="item-name">${info.name}</span><span class="item-count">${info.count}</span>`;
      } else {
        slot.innerHTML = `<span class="item-name">Empty</span>`;
      }
    }
  }

  updateHealth(health: number) {
    this.healthEl.textContent = `❤️ ${health}`;
  }

  showPrompt(text: string) {
    this.promptEl.textContent = text;
    setTimeout(() => { this.promptEl.textContent = ''; }, 2000);
  }

  update(): void {
    this.updateHealth(this.player.health);
    this.updateHotbar(this.currentSlot);
  }

  dispose() {
    for (const unsub of this.unsubscribeFns) unsub();
    this.unsubscribeFns = [];
  }
}