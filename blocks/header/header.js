import { decorateButtons, decorateBlocks, decorateSections } from "../../scripts/lib-franklin.js";
import { toMjml } from "../../scripts/scripts.js";

export default async function decorate(block) {
    const contentClasses = { 
        wrapperClass: 'mj-header-wrapper',
        sectionClass: 'mj-header-section',
        columnClass: 'mj-header-column',
        textClass: 'mj-header-text', 
        buttonClass: 'mj-header-button', 
    }
    const resp = await fetch('/header.plain.html');

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