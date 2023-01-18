import fetch from 'node-fetch';
import jsdom from 'jsdom';
import less from 'less';
import mjml from 'mjml';
import { init as initLibFranklin } from '../../../../scripts/lib-franklin.js';
import { decorateMain, mjml2html, init as initScripts } from '../../../../scripts/scripts.js';

async function render(base, url) {
    const resp = await fetch(url);

    if (!resp.ok) {
        return { statusCode: resp.status, body: resp.statusText }
    }

    const text = await resp.text();

    // create dom
    const dom = new jsdom.JSDOM(text, { url });
    dom.window.fetch = (path, options) => fetch(path.charAt(0) === '/' ? base + path : path, options);
    dom.window.less = less;
    dom.window.mjml = mjml;

    // franklin
    const main = dom.window.document.querySelector('main');
    initLibFranklin(dom.window);
    initScripts(dom.window);
    decorateMain(main);

    return { statusCode: 200, body: await mjml2html(main) };
}

export async function main(params) {
    const path =  params['__ow_path'] ? params['__ow_path'].substring(1) : '';
    const host = `${params['branch'] || 'main'}--ibx-email--buuhuu.hlx.${params['preview'] ? 'page' : 'live'}`;
    return render(`https://${host}`, `https://${host}/${path}`);
}
