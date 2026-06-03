import { Page } from 'playwright';
import { v4 as uuid } from 'uuid';
import { RawElementRecord, ElementRecord } from '../shared/types';

const DOM_EXTRACTION_SCRIPT = `
  (() => {
    const INTERACTIVE_SELECTORS = [
      'input', 'textarea', 'select', 'button',
      '[role="button"]', '[role="textbox"]', '[role="combobox"]',
      '[contenteditable="true"]'
    ];
    
    const elements = document.querySelectorAll(INTERACTIVE_SELECTORS.join(','));
    
    return Array.from(elements).map(el => {
      const rect = el.getBoundingClientRect();
      const id = el.getAttribute('id');
      
      // Label resolution — 4 mechanisms, priority order
      let labelText = null;
      
      // Mechanism 1: for/id association
      if (id) {
        const label = document.querySelector(\`label[for="\${id}"]\`);
        if (label) labelText = label.textContent?.trim();
      }
      
      // Mechanism 2: wrapping label (implicit)
      if (!labelText) {
        const parent = el.closest('label');
        if (parent) {
          const clone = parent.cloneNode(true);
          clone.querySelectorAll('input,textarea,select').forEach(c => c.remove());
          labelText = clone.textContent?.trim();
        }
      }
      
      // Mechanism 3: aria-labelledby
      if (!labelText) {
        const labelledBy = el.getAttribute('aria-labelledby');
        if (labelledBy) {
          labelText = labelledBy.split(' ')
            .map(id => document.getElementById(id)?.textContent?.trim())
            .filter(Boolean).join(' ');
        }
      }
      
      // Mechanism 4: aria-label direct
      if (!labelText) {
        labelText = el.getAttribute('aria-label');
      }
      
      // ── Tier 6: Nearby visible text heuristic ─────────────────────────────
      const nearbyText = (() => {
        const prev = el.previousElementSibling;
        if (prev?.textContent?.trim()) return prev.textContent.trim();
        const parent = el.parentElement;
        if (parent) {
          const clone = parent.cloneNode(true);
          clone.querySelectorAll('input,textarea,select,button').forEach(c => c.remove());
          const t = clone.textContent?.trim();
          if (t) return t;
        }
        return '';
      })();
      
      // ── Error signal: adjacent error element detection ─────────────────────
      const hasAdjacentError = (() => {
        const parent = el.parentElement;
        if (!parent) return false;
        return !!(  
          parent.querySelector('[role="alert"]')              ||
          parent.querySelector('[aria-live="polite"]')        ||
          parent.querySelector('[data-slot="form-message"]')  ||
          parent.querySelector('.error-message')              ||
          parent.querySelector('[class*="error"]')
        );
      })();
      
      // ── Selector generator ─────────────────────────────────────────────
      const generateSelector = (e) => {
        if (e.id) return '#' + CSS.escape(e.id);
        if (e.name) return e.tagName.toLowerCase() + '[name="' + CSS.escape(e.name) + '"]';
        
        let path = [];
        let current = e;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          let sel = current.nodeName.toLowerCase();
          if (current.id) {
            sel += '#' + CSS.escape(current.id);
            path.unshift(sel);
            break;
          } else {
            let sibling = current;
            let nth = 1;
            while (sibling = sibling.previousElementSibling) {
              if (sibling.nodeName.toLowerCase() == sel) nth++;
            }
            if (nth !== 1) {
              sel += \`:nth-of-type(\${nth})\`;
            }
          }
          path.unshift(sel);
          current = current.parentNode;
        }
        return path.join(' > ');
      };
      
      const selector = generateSelector(el);
      
      return {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type'),
        id: id,
        name: el.getAttribute('name'),
        ariaLabel: el.getAttribute('aria-label'),
        ariaLabelledBy: el.getAttribute('aria-labelledby'),
        placeholder: el.getAttribute('placeholder'),
        value: el.value || el.textContent || '',
        labelText,
        nearbyText,
        hasAdjacentError,
        visible: rect.width > 0 && rect.height > 0 && 
                 window.getComputedStyle(el).display !== 'none',
        disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
        required: el.required || el.getAttribute('aria-required') === 'true',
        ariaInvalid: el.getAttribute('aria-invalid'),
        boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        role: el.getAttribute('role') || el.tagName.toLowerCase(),
        parentFormId: el.closest('form')?.getAttribute('id') || null,
        selector,
      };
    });
  })()
`;

export class DOMObserver {
  async extract(page: Page): Promise<ElementRecord[]> {
    const rawElements: RawElementRecord[] = await page.evaluate(DOM_EXTRACTION_SCRIPT);
    
    // UUID assigned here — browser context has no uuid package
    // frameContext is null for main-frame elements;
    // FrameManager.extractFromFrame(frameId, page) overwrites it for sub-frames
    return rawElements.map(el => ({
      ...el,
      elementId: uuid(),   // stable reference ID for this observation cycle
      frameContext: null,  // injected by FrameManager if element is inside an iframe
    }));
  }
}
