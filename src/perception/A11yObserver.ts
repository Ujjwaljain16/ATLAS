import { Page } from 'playwright';
import { A11yRecord } from './types';

export class A11yObserver {
  async extract(page: Page): Promise<A11yRecord[]> {
    // Replace deprecated page.accessibility.snapshot with DOM evaluation
    return page.evaluate(() => {
      const INTERACTIVE_SELECTORS = [
        'input', 'textarea', 'select', 'button',
        '[role="button"]', '[role="textbox"]', '[role="combobox"]',
        '[role="searchbox"]', '[role="checkbox"]', '[role="radio"]', '[role="listbox"]'
      ];
      
      const elements = document.querySelectorAll(INTERACTIVE_SELECTORS.join(','));
      const records: any[] = [];
      
      for (const el of elements) {
        let name = el.getAttribute('aria-label') || '';
        if (!name) {
          const labelledBy = el.getAttribute('aria-labelledby');
          if (labelledBy) {
            name = labelledBy.split(' ')
              .map(id => document.getElementById(id)?.textContent?.trim())
              .filter(Boolean).join(' ') || '';
          }
        }
        if (!name) {
          if (el.tagName.toLowerCase() === 'input' && el.getAttribute('id')) {
            const label = document.querySelector(`label[for="${el.getAttribute('id')}"]`);
            if (label) name = label.textContent?.trim() || '';
          }
        }
        if (!name) name = el.textContent?.trim() || '';
        
        let role = el.getAttribute('role');
        if (!role) {
          const tag = el.tagName.toLowerCase();
          if (tag === 'button') role = 'button';
          else if (tag === 'input') {
            const type = el.getAttribute('type');
            if (type === 'checkbox') role = 'checkbox';
            else if (type === 'radio') role = 'radio';
            else role = 'textbox';
          }
          else if (tag === 'textarea') role = 'textbox';
          else if (tag === 'select') role = 'combobox';
        }
        
        records.push({
          role: role || '',
          name: name,
          value: (el as HTMLInputElement).value || '',
          disabled: (el as any).disabled || el.getAttribute('aria-disabled') === 'true',
        });
      }
      return records;
    }) as Promise<A11yRecord[]>;
  }

  buildConfirmedNameSet(records: A11yRecord[]): Set<string> {
    const set = new Set<string>();
    for (const r of records) {
      if (r.name) set.add(r.name);
    }
    return set;
  }
}
