import { decorateDefaultContent } from '../../scripts/scripts.js';

export default async function decorate(block) {
  const content = block.querySelector(':scope > div > div');
  const { align = 'left' } = content.dataset;
  const classes = {
    textClass: `mj-box-text mj-align-${align}`,
    headingClass: `mj-box-heading mj-align-${align}`,
    buttonClass: `mj-box-button mj-align-${align}`,
  };

  return `
        <mj-section mj-class="mj-box-section">
            <mj-column>
                ${decorateDefaultContent(content, classes)}
            </mj-column>
        </mj-section>
    `;
}
