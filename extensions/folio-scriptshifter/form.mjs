// Executed in the active tab only after the extension button is clicked.
export function inspectForm(includeEmpty = false) {
  const visible = el => !!el.getClientRects().length && !el.disabled && !el.readOnly &&
    !el.closest('[hidden], [aria-hidden="true"]');
  const labelText = node => {
    const copy = node.cloneNode(true);
    copy.querySelectorAll('input, textarea, select, button').forEach(el => el.remove());
    return copy.textContent.trim();
  };
  const label = el => [...(el.labels || [])].map(labelText).join(' ') ||
    el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || el.id || 'Unlabelled field';
  // Inventory renders the creation/editing layer beside the search/filter panes.
  // Use its actual form marker, never all document inputs.
  const candidates = [...document.querySelectorAll('form[data-test-instance-page-type]')].filter(visible);
  if (!candidates.length) {
    for (const title of document.querySelectorAll('#input_instance_title, form input[name="title"]')) {
      const form = title.closest('form');
      if (form && visible(form) && !candidates.includes(form)) candidates.push(form);
    }
  }
  if (candidates.length !== 1) throw new Error('Open one FOLIO New instance or Edit instance form, then load fields again. Search and filter controls are excluded.');
  const scope = candidates[0];
  const recordText = el => !el.closest('[role="search"], [role="searchbox"]') &&
    !['combobox','searchbox'].includes(el.getAttribute('role')) && !el.hasAttribute('aria-autocomplete');
  const inputs = [...scope.querySelectorAll('input, textarea')].filter(el =>
    (el.tagName === 'TEXTAREA' || ['text', ''].includes(el.type)) && visible(el) && recordText(el) && (includeEmpty || el.value.trim()));
  const token = crypto.randomUUID();
  const entries = inputs.map((el, index) => {
    const key = `${token}-${index}`;
    el.setAttribute('data-folio-scriptshifter', key);
    return {key, label: label(el), text: el.value};
  });
  // Use a single unambiguous record-language control; do not infer from UI locale.
  const langs = [...scope.querySelectorAll('input, select')].filter(el => visible(el) &&
    /^(record )?language(s)?\s*:?$/i.test(label(el))).map(el =>
      el.tagName === 'SELECT' ? el.selectedOptions[0]?.textContent.trim() : el.value).filter(Boolean);
  return {entries, language: langs.length === 1 ? langs[0] : '', url: location.href};
}

export function applyField(key, before, after, originalUrl) {
  if (location.href !== originalUrl) throw new Error('The record page changed. Refresh fields and preview again.');
  const matches = [...document.querySelectorAll('[data-folio-scriptshifter]')].filter(el =>
    el.getAttribute('data-folio-scriptshifter') === key);
  if (matches.length !== 1) throw new Error('Field changed or disappeared. Refresh fields.');
  const el = matches[0];
  if (!el.isConnected || !el.getClientRects().length || el.disabled || el.readOnly || el.value !== before) {
    throw new Error('Field changed since preview. Refresh fields and preview again.');
  }
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, after);
  el.dispatchEvent(new Event('input', {bubbles: true}));
  el.dispatchEvent(new Event('change', {bubbles: true}));
  return true;
}
