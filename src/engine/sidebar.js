// Общие блоки боковой панели, которые повторяются во всех пространствах.
import { categoryById, LEVELS } from './catalog.js';
import { escapeHtml } from './format.js';

/** Шапка: ссылка в каталог, категория, название и краткое описание пространства */
export function headerHtml(meta) {
  const cat = categoryById(meta.category);
  return `
    <header class="brand">
      <a class="back" href="./">← Каталог</a>
      <div class="badges">
        ${cat ? `<span class="badge">${cat.icon} ${escapeHtml(cat.title)}</span>` : ''}
        ${meta.level ? `<span class="badge muted">${LEVELS[meta.level]}</span>` : ''}
      </div>
      <h1>${escapeHtml(meta.title)}</h1>
      ${meta.summary ? `<p class="muted">${escapeHtml(meta.summary)}</p>` : ''}
    </header>`;
}

/** Карточка-раскрывашка с произвольным HTML (пояснения пространства) */
export function detailsCardHtml({ title, html, open = true }) {
  return `
    <details class="card"${open ? ' open' : ''}>
      <summary><h2>${escapeHtml(title)}</h2></summary>
      ${html}
    </details>`;
}

export const FORWARD_PASS_HTML = `
  <p>Forward pass (прямой проход) — это вычисление ответа сети. Сигнал идёт строго слева направо, слой за слоем:</p>
  <ol class="steps">
    <li>Во <b>входной слой</b> подаются числа — это «данные».</li>
    <li>Каждое число умножается на <b>вес</b> связи и передаётся дальше.</li>
    <li>Нейрон следующего слоя <b>складывает</b> всё, что пришло, добавляет смещение и пропускает сумму через <b>функцию активации</b>.</li>
    <li>Так повторяется до <b>выходного слоя</b> — его значения и есть ответ сети.</li>
  </ol>
  <p class="muted">На экране: слой «загорается», когда его нейроны посчитали значения, а по связям бегут светящиеся импульсы — это сигнал, переходящий в следующий слой.</p>
  <p id="stage" class="stage muted">Нажмите «Запустить forward pass» или пробел.</p>`;

export const LEGEND_HTML = `
  <ul class="legend">
    <li><span class="dot idle"></span><span><b>Шар — нейрон.</b> Хранит одно число — активацию. Серый шар — нейрон ещё не посчитан или его значение около нуля.</span></li>
    <li><span class="dot glow-pos"></span><span><b>Яркость и свечение</b> — насколько сильно нейрон активирован: чем больше |значение|, тем ярче. <b class="pos">Тёплый</b> — значение положительное, <b class="neg">холодный</b> — отрицательное.</span></li>
    <li><span class="line pos"></span><span><b>Линия — связь с весом.</b> <b class="pos">Оранжевая</b> — вес положительный (усиливает сигнал).</span></li>
    <li><span class="line neg"></span><span><b class="neg">Синяя</b> — вес отрицательный (подавляет сигнал).</span></li>
    <li><span class="line weak"></span><span><b>Серая</b> — слабый вес, почти не влияет. Чем насыщеннее цвет, тем больше |вес|.</span></li>
    <li><span class="line thick"></span><span><b>Толстая яркая линия</b> — по связи прямо сейчас идёт сигнал.</span></li>
  </ul>`;

export const HINT_HTML = `
  <p class="hint muted">Мышь: ЛКМ — вращать · колесо — масштаб · ПКМ — сдвиг.<br />
  Клавиши: пробел — forward pass, N — показать/скрыть числа.</p>`;
