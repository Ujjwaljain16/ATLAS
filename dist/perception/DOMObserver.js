"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOMObserver = void 0;
const uuid_1 = require("uuid");
const DOM_EXTRACTION_SCRIPT = `
  (() => {
    const INTERACTIVE_SELECTORS = [
      'input', 'textarea', 'select', 'button',
      '[role="button"]', '[role="textbox"]', '[role="combobox"]',
      '[contenteditable="true"]'
    ];
    
    // ── Element Extraction ─────────────────────────────────────────────
    const elementNodes = document.querySelectorAll(INTERACTIVE_SELECTORS.join(','));
    const elements = Array.from(elementNodes).map(el => {
      const rect = el.getBoundingClientRect();
      const id = el.getAttribute('id');
      
      let labelText = null;
      if (id) {
        const label = document.querySelector(\`label[for="\${id}"]\`);
        if (label) labelText = label.textContent?.trim();
      }
      if (!labelText) {
        const parent = el.closest('label');
        if (parent) {
          const clone = parent.cloneNode(true);
          clone.querySelectorAll('input,textarea,select').forEach(c => c.remove());
          labelText = clone.textContent?.trim();
        }
      }
      if (!labelText) {
        const labelledBy = el.getAttribute('aria-labelledby');
        if (labelledBy) {
          labelText = labelledBy.split(' ')
            .map(id => document.getElementById(id)?.textContent?.trim())
            .filter(Boolean).join(' ');
        }
      }
      if (!labelText) {
        labelText = el.getAttribute('aria-label');
      }
      
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
      
      const parentForm = el.closest('form');
      let parentFormId = null;
      if (parentForm) {
        parentFormId = parentForm.getAttribute('id');
        if (!parentFormId) {
          let path = [];
          let current = parentForm;
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
              if (nth !== 1) { sel += \`:nth-of-type(\${nth})\`; }
            }
            path.unshift(sel);
            current = current.parentNode;
          }
          parentFormId = \`form_\${path.join(' > ')}\`;
        }
      }
      
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
        visible: rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none',
        disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
        required: el.required || el.getAttribute('aria-required') === 'true',
        ariaInvalid: el.getAttribute('aria-invalid'),
        boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        role: el.getAttribute('role') || el.tagName.toLowerCase(),
        parentFormId,
        selector,
      };
    });

    // ── Form Extraction ─────────────────────────────────────────────
    const formNodes = document.querySelectorAll('form');
    const forms = Array.from(formNodes).map(form => {
      const id = form.getAttribute('id');
      
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
            if (nth !== 1) { sel += \`:nth-of-type(\${nth})\`; }
          }
          path.unshift(sel);
          current = current.parentNode;
        }
        return path.join(' > ');
      };

      // Extract context elements inside the form
      const heading = form.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim() || null;
      const legend = form.querySelector('legend')?.textContent?.trim() || null;
      const title = form.getAttribute('title') || null;

      return {
        id,
        name: form.getAttribute('name'),
        ariaLabel: form.getAttribute('aria-label'),
        title,
        heading,
        legend,
        selector: generateSelector(form)
      };
    });
    
    return { elements, forms };
  })()
`;
class DOMObserver {
    async extract(page) {
        const rawResult = await page.evaluate(DOM_EXTRACTION_SCRIPT);
        const elements = rawResult.elements.map(el => ({
            ...el,
            elementId: (0, uuid_1.v4)(),
            frameContext: null,
        }));
        return { elements, forms: rawResult.forms };
    }
}
exports.DOMObserver = DOMObserver;
