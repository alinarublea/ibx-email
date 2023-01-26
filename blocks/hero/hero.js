import { decorateDefaultContent } from '../../scripts/scripts.js';

export default async function decorate(block) {
  const { src } = block.querySelector(':scope > div > div img');
  const text = block.querySelector(':scope > div > div > :nth-child(2)');

  return `
        <mj-section>
            <mj-column>
                <mj-image mj-class="mj-hero-image" src="${src}" />
                <mj-divider mj-class="mj-hero-divider"/>
                ${decorateDefaultContent({ children: [text] }, { textClass: 'mj-hero-text' })}
                <mj-divider mj-class="mj-hero-divider"/>
            </mj-column>
        </mj-section>
    `;
}
