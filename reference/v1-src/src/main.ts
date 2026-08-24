import { Game } from './core/game';

let game: Game | null = null;

window.addEventListener('DOMContentLoaded', () => {
  game = new Game();
  void game.start();

  const overlay = document.getElementById('click-overlay')!;
  overlay.addEventListener('click', () => {
    game?.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) {
      overlay.style.display = 'none';
    } else {
      overlay.style.display = 'flex';
    }
  });
});

// للاختبار عند إعادة التشغيل:
export async function restartGame() {
  if (game) {
    await game.dispose();
  }
  game = new Game();
  await game.start();
}