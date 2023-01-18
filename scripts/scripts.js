import {
  buildBlock,
  decorateBlocks,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateTemplateAndTheme,
} from './lib-franklin.js';

let window = {};
let document = {};
const thridPartyScripts = {};

const mjmlTemplate = (mjmlHead, mjmlBody, bodyCssClasses = []) => `
  <mjml>
    <mj-head>
      ${mjmlHead}
    </mj-head>
    <mj-body css-class="${bodyCssClasses.join(' ')}">
      ${mjmlBody}
    </mj-body>
  </mjml>
  `;

async function loadScript(src) {
  if (!document.querySelector(`head > script[src="${src}"]`)) {
    thridPartyScripts[src] = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.crossOrigin = true;
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return thridPartyScripts[src];
  }
  return thridPartyScripts[src];
}

async function loadMjml(src = 'https://unpkg.com/mjml-browser@4.13.0/lib/index.js') {
  if (!window.mjml) {
    await loadScript(src);
  }
  return window.mjml;
}

async function loadLess(src = 'https://unpkg.com/less@4.1.3/dist/less.min.js') {
  if (!window.less) {
    await loadScript(src);
  }
  return window.less;
}

async function loadBlock(block) {
  const status = block.getAttribute('data-block-status');
  const blockName = block.getAttribute('data-block-name');
  let decorator;
  if (status !== 'loading') {
    block.setAttribute('data-block-status', 'loading');
    try {
      const blockModule = await import(`../blocks/${blockName}/${blockName}.js`);
      if (!blockModule.default) {
        throw new Error('default export not found');
      }
      decorator = async (b) => {
        try {
          return await blockModule.default(b, window);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.log(`failed to load module for ${blockName}`, error);
          return null;
        }
      };
      if (blockModule.styles) {
        decorator.styles = blockModule.styles
          .map((stylesheet) => `/blocks/${blockName}/${stylesheet}`);
      }
      if (blockModule.inlineStyles) {
        decorator.inlineStyles = blockModule.inlineStyles
          .map((stylesheet) => `/blocks/${blockName}/${stylesheet}`);
      }
      if (!blockModule.styles && !blockModule.inlineStyles) {
        decorator.inlineStyles = [`/blocks/${blockName}/${blockName}.css`];
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(`failed to load block ${blockName}`, error);
      decorator = async () => Promise.reject(error);
    }
    block.setAttribute('data-block-status', 'loaded');
  } else {
    console.log(`tried to load block twice ${blockName}`);
    decorator = async () => Promise.resolve();
  }

  return decorator;
}

async function parseStyle(css) {
  const less = await loadLess();
  const ast = await less.parse(css);
  const attributes = {};
  const isTemplate = (stmt) => document.body.matches(stmt);

  for (let i = 0; i < ast.rules.length; i += 1) {
    const rule = ast.rules[i];
    if (rule.type === 'Comment') {
      // remove comments in general
      ast.rules.splice(i, 1);
      i -= 1;
    } else if (rule.isRuleset) {
      // get the mj-* selectors
      const defs = rule.selectors
        .map((selector) => {
          const isMjTag = (element) => element && element.value.indexOf('mj-') === 0;
          const isMjClass = (element) => element && element.value.indexOf('.mj-') === 0;
          const toDef = (first, second) => {
            if (isMjClass(first)) {
              if (second || first.value.substring(1).indexOf('.') > 0) {
                console.log('chaining mj-class selectors is not supported');
                return null;
              }
              return { mjEl: 'mj-all', mjClass: first.value.substring(1) };
            }
            if (isMjTag(first)) {
              if (second && second.value && second.value.charAt(0) === '.') {
                if (first.value !== 'mj-all') {
                  // mj-class is not element specific
                  console.log('className not supported for mj elements other than mj-all');
                  return null;
                }
                return { mjEl: first.value, mjClass: second.value.substring(1) };
              }
              return { mjEl: first.value };
            }
            return null;
          };
          const first = selector.elements[0];
          const second = selector.elements[1];
          const def = toDef(first, second);
          if (def) {
            return def;
          }
          if ((isMjTag(second) || isMjClass(second)) && isTemplate(first.value)) {
            return toDef(second, selector.elements[2]);
          }
          return null;
        })
        .filter((def) => !!def);

      if (defs.length) {
        // remove the rule from the ruleset
        ast.rules.splice(i, 1);
        i -= 1;
        const declarations = rule.rules
          .map((declaration) => {
            const [{ value: name }] = declaration.name;
            let value = declaration.value.toCSS();
            if (value.charAt(0) === '\'' && value.charAt(value.length - 1) === '\'') {
              value = value.substring(1, value.length - 1);
            }
            return [name, value];
          })
          .filter((decl) => !!decl)
          .reduce((map, [name, value]) => ({ ...map, [name]: value }), {});
        if (Object.keys(declarations).length) {
          defs.forEach(({ mjEl, mjClass = '*' }) => {
            if (!attributes[mjEl]) attributes[mjEl] = {};
            if (!attributes[mjEl][mjClass]) attributes[mjEl][mjClass] = {};
            attributes[mjEl][mjClass] = { ...attributes[mjEl][mjClass], ...declarations };
          });
        }
      }
    }
  }

  const { css: genCss } = new less.ParseTree(ast, []).toCSS({});

  return [attributes, genCss];
}

async function loadStyles({ styles, inlineStyles }) {
  const loadStyle = async (stylesheet, inline) => {
    const resp = await window.fetch(`${window.hlx.codeBasePath}${stylesheet}`);
    if (resp.ok) {
      let mjml = '';
      const text = (await resp.text()).trim();
      if (text) {
        const [attributes, parsedStyles] = await parseStyle(text);

        if (Object.keys(attributes).length) {
          mjml += '<mj-attributes>\n';
          Object.keys(attributes).forEach((mjEl) => {
            Object.keys(attributes[mjEl]).forEach((mjClass) => {
              if (mjClass === '*') {
                mjml += `<${mjEl} `;
              } else {
                mjml += `<mj-class name="${mjClass}" `;
              }
              mjml += Object.entries(attributes[mjEl][mjClass])
                .map(([name, value]) => `${name}="${value}"`)
                .join(' ');
              mjml += '/>\n';
            });
          });
          mjml += '</mj-attributes>\n';
        }
        if (parsedStyles) {
          mjml += `
              <mj-style${inline ? ' inline="inline"' : ''}>
                ${parsedStyles}
              </mj-style>
            `;
        }
      }
      return mjml;
    }
    console.log(`failed to load stylesheet: ${stylesheet}`);
    return '';
  };
  const styles$ = styles
    ? styles.map(async (stylesheet) => loadStyle(stylesheet, false))
    : [];
  const inlineStyles$ = inlineStyles
    ? inlineStyles.map(async (stylesheet) => loadStyle(stylesheet, true))
    : [];

  return Promise.all(styles$.concat(inlineStyles$))
    .then((resolvedStylesheets) => resolvedStylesheets.join(''));
}

function reduceMjml(mjml) {
  return mjml.reduce(
    ([body, head], [sectionBody, sectioHead]) => [
      body + (sectionBody || ''),
      head + (sectioHead || ''),
    ],
    ['', ''],
  );
}

export function decorateDefaultContent(wrapper, { textClass = '', headingClass = '', buttonClass = '', imageClass = '' } = {}) {
  return [...wrapper.children]
    .reduce((mjml, par) => {
      const img = par.querySelector('img');
      if (img) {
        return `${mjml}<mj-image mj-class="${imageClass || ''}" src="${img.src}" />`;
      }
      if (par.matches('.button-container')) {
        const link = par.querySelector(':scope a');
        const [,type] = link.classList;
        return `${mjml}
                <mj-button mj-class="mj-button-${type} ${buttonClass || ''}" href="${link.href}">
                  ${link.textContent}
                </mj-button>
            `;
      }
      if (par.matches('h1, h2, h3, h4, h5, h6')) {
        // trailing space to force the text not to be merged with the next one if any (see below);
        return `${mjml}<mj-text mj-class="mj-${par.tagName.toLowerCase()} ${headingClass || ''}">${par.outerHTML}</mj-text> `;
      }
      if (mjml.endsWith('</mj-text>')) {
        return `${mjml.substring(0, mjml.length - 10)}${par.outerHTML}</mj-text>`;
      }
      return `${mjml}<mj-text mj-class="${textClass || ''}">${par.outerHTML}</mj-text>`;
    }, '');
}

export async function toMjml(main, contentClasses = { 
  wrapperClass: '',
  sectionClass: 'mj-content-section',
  columnClass: 'mj-content-column',
  textClass: 'mj-content-text', 
  imageClass: 'mj-content-image', 
  buttonClass: 'mj-content-button', 
  headingClass: 'mj-content-heading' 
}) {
  main = await Promise.all([...main.querySelectorAll(':scope > .section')]
    .map(async (section) => {
      const [sectionBody, sectionHead] = reduceMjml(await Promise.all([...section.children]
        .map(async (wrapper) => {
          if (wrapper.matches('.default-content-wrapper')) {
            return Promise.resolve([`
            <mj-section mj-class="${contentClasses.sectionClass || ''}">
              <mj-column mj-class="${contentClasses.columnClass || ''}">
                ${decorateDefaultContent(wrapper, contentClasses)}
              </mj-column>
            </mj-section>
          `]);
          }
          const block = wrapper.querySelector('.block');
          if (block) {
            const decorator = await loadBlock(block);
            const decorated$ = decorator(block);
            const styles$ = loadStyles(decorator);
            return Promise.all([decorated$, styles$])
              .then(([body, head]) => body instanceof Array ? [body[0], body[1] + head] : [body, head])
              .catch((err) => {
                console.error(err);
                return [];
              });
          }
          return Promise.resolve([]);
        })));

      return [
        sectionBody.indexOf('<mj-wrapper') < 0
          ? `<mj-wrapper mj-class="${contentClasses.wrapperClass || ''}">${sectionBody}</mj-wrapper>`
          : sectionBody,
        sectionHead
      ];
    }));
  
  return reduceMjml(main);
}

export async function mjml2html(main) {
  const mjml2html$ = loadMjml();
  const styles$ = loadStyles({ styles: ['/styles/email-styles.css'], inlineStyles: ['/styles/email-inline-styles.css'] });
  const [body, head] = await toMjml(main)
  const mjmlStyles = await styles$;

  const mjml = mjmlTemplate(mjmlStyles + head, body, [...document.body.classList]);

  const mjml2html = await mjml2html$;
  const { html } = mjml2html(mjml, { minify: true });

  return html;
}

function buildHeroBlock(main) {
  const firstSection = main.querySelector(':scope > div');
  const picture = firstSection && firstSection.querySelector('picture');
  const text = firstSection && firstSection.querySelector(':scope > :nth-child(2)');
  if (picture && text) {
    const section = document.createElement('div');
    section.append(buildBlock('hero', { elems: [picture, text] }));
    firstSection.replaceWith(section);
  }
}

function buildHeaderBlock(main) {
  const section = document.createElement('div');
  section.append(buildBlock('header', { elems: [] }));
  if (window.location.pathname === '/header') main.innerHTML = section.outerHTML;
  else main.prepend(section);
}

function buildFooterBlock(main) {
  const section = document.createElement('div');
  section.append(buildBlock('footer', { elems: [] }));
  if (window.location.pathname === '/footer') main.innerHTML = section.outerHTML;
  else main.append(section);
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    buildHeroBlock(main);
    if (window.location.pathname !== '/footer') buildHeaderBlock(main);
    if (window.location.pathname !== '/header') buildFooterBlock(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

function decoratePersonalization(main) {
  main.querySelectorAll('em').forEach((em) => {
    let text = em.textContent.trim();
    let content = '';
    let unwrap = true;
    let match;

    const transform = (expr) => {
      const nlExpr = `<%= ${expr} %>`;
      return `<span data-nl-expr="${expr}">${nlExpr}</span>`;
    }

    // eslint-disable-next-line no-cond-assign
    while (match = text.match(/[a-zA-Z0-9]+\.[a-zA-Z0-9.]+/)) {
      if (match.index > 0) {
        const fragment = text.substring(0, match.index);
        content += fragment;
        // unwrap only if there are only non-word characters in between the expressions
        unwrap = unwrap && !!fragment.match(/^\W+$/);
      }

      content += transform(match[0]);
      text = text.substring(match.index + match[0].length);
    }

    if (unwrap) {
      em.insertAdjacentHTML('afterend', content);
      em.remove();
    } else {
      em.innerHTML = content;
    }
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  decorateTemplateAndTheme();
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  decoratePersonalization(main);
}

export function init(w) {
  window = w;
  document = w.document;
}
