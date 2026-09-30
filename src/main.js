import './styles.css';
import { Game } from './game.js';
import { loadFonts } from './gfx/text.js';

const params = new URLSearchParams(location.search);

async function boot() {
  const canvas = document.getElementById('gl');
  const root = document.getElementById('ui');
  try {
    await loadFonts();
    const game = new Game(canvas, root, { debug: params.has('debug') });
    game.start();
    // фон титульного экрана — живой Рабочий стол
    await game.enterZone('desktop', 'default', { fresh: true, menu: true });
    game.setState('menu');
    game.ui.showTitle();
    if (params.has('autostart')) {
      game.ui.clearScreens();
      await game.newGame(params.get('autostart') === 'speedrun' ? 'speedrun' : 'story');
    }
  } catch (e) {
    console.error(e);
    const el = document.getElementById('fatal');
    el.style.display = 'block';
    el.textContent = 'STOP: ' + (e?.stack || e);
  }
}
boot();
