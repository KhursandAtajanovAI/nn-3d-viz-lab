// Общие блоки боковой панели, которые повторяются во всех пространствах.
// Тексты — из словарей (lab.*); заголовки и описания пространств — L(...) из конфига или строки пользователя.
import { categoryById, LEVELS, FIDELITY } from './catalog.js';
import { T, Tx, Hx, At, langSwitchHtml } from '../i18n/i18n.js';
import { themeSwitchHtml } from './theme.js';

/** Шапка: ссылка в каталог, категория, название, описание и «где применяется» */
export function headerHtml(meta) {
  const cat = categoryById(meta.category);
  const fid = FIDELITY[meta.fidelity];
  return `
    <header class="brand">
      <div class="brand-top"><a class="back" href="./">${T('lab.backToCatalog')}</a><div class="switches">${themeSwitchHtml()}${langSwitchHtml()}</div></div>
      <div class="badges">
        ${cat ? `<a class="badge" href="${cat.user ? './#my-spaces' : `./?cat=${cat.id}`}">${cat.icon} ${T(cat.title)}</a>` : ''}
        ${meta.level ? `<span class="badge muted">${T(LEVELS[meta.level])}</span>` : ''}
        ${fid ? `<span class="badge fidelity ${meta.fidelity}" ${At('title', fid.hint)}>${T(fid.title)}</span>` : ''}
      </div>
      <h1>${Tx(meta.title)}</h1>
      ${meta.summary ? `<p class="muted">${Tx(meta.summary)}</p>` : ''}
      ${meta.uses ? `<p class="uses"><b>${T('common.usesLabel')}</b> ${Tx(meta.uses)}</p>` : ''}
      ${fid && meta.fidelity !== 'real' ? `<p class="fidelity-note small muted">${Tx(meta.fidelityNote ?? fid.hint)}</p>` : ''}
    </header>`;
}

/** Карточка-раскрывашка (пояснения пространства): title и html — L(...) или строки */
export function detailsCardHtml({ title, html, open = true }) {
  return `
    <details class="card"${open ? ' open' : ''}>
      <summary><h2>${Tx(title)}</h2></summary>
      ${Hx(html)}
    </details>`;
}

export const forwardPassHtml = () => `${T('lab.forwardPassHtml', undefined, 'div')}
  <p id="stage" class="stage muted">${T('lab.stageIdle')}</p>`;

export const legendHtml = () => T('lab.legendHtml', undefined, 'div');

export const hintHtml = () => `<p class="hint muted">${T('lab.hintHtml')}</p>`;
