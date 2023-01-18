import { waitForLCP, init as initLibFranklin } from './lib-franklin.js';
import { decorateMain, toMjml, init as initScripts } from './scripts.js';

window.hlx = window.hlx || {};

async function loadPage() {
  initLibFranklin(window);
  initScripts(window);

  const main = document.querySelector('main');
  decorateMain(main);
  await waitForLCP([]);

  const html = await toMjml(main);

  let frame = document.getElementById('__emailFrame');
  if (!frame) {
    frame = document.createElement('iframe');
    frame.srcdoc = html;
    frame.width = '100%';
    frame.height = '100%';
    frame.id = '__emailFrame';
    document.body.insertAdjacentElement('beforeend', frame);
  } else {
    frame.srcdoc = html;
  }

  if (document.querySelector('helix-sidekick')) {
    await import('../tools/sidekick/plugins.js');
  } else {
    document.addEventListener('helix-sidekick-ready', () => import('../tools/sidekick/plugins.js'), { once: true });
  }
}

loadPage();
