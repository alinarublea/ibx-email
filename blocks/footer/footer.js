import { decorateButtons, decorateBlocks, decorateSections } from "../../scripts/lib-franklin.js";
import { toMjml } from "../../scripts/scripts.js";

export default async function decorate(block, { fetch }) {
    const contentClasses = { 
        wrapperClass: 'mj-footer-wrapper',
        sectionClass: 'mj-footer-section',
        columnClass: 'mj-footer-column',
        textClass: 'mj-footer-text', 
        buttonClass: 'mj-footer-button', 
    }
    const resp = await fetch('/footer.plain.html');

    if (resp.ok) {
        block.innerHTML = await resp.text();
        
        decorateButtons(block);
        decorateSections(block);
        decorateBlocks(block);
 
        return toMjml(block, contentClasses);
    } else {
        return [];
    }
}