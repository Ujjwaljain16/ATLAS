import { Page } from 'playwright';
import { v4 as uuid } from 'uuid';
import { InteractiveElement } from '../shared/types';

const DOM_EXTRACTION_SCRIPT = `
  (() => {
    const INTERACTIVE_SELECTORS = [
      'input', 'textarea', 'select', 'button', 'a',
      '[role="button"]', '[role="textbox"]', '[role="combobox"]',
      '[role="menuitem"]', '[role="checkbox"]', '[role="radio"]',
      '[role="slider"]', '[role="tab"]', '[role="dialog"]',
      'video', 'audio', '[contenteditable="true"]', 'canvas', 'iframe',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'article', 'section'
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
        if (prev?.textContent?.trim()) return prev.textContent.trim().substring(0, 200);
        const parent = el.parentElement;
        // Only clone if parent is small enough to avoid massive clones and text blobs
        if (parent && parent.children.length < 10) {
          const clone = parent.cloneNode(true);
          clone.querySelectorAll('input,textarea,select,button').forEach(c => c.remove());
          const t = clone.textContent?.trim();
          if (t) return t.substring(0, 200);
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
        if (e.id) {
          // Check if ID is actually unique in the document
          try {
            if (document.querySelectorAll('#' + CSS.escape(e.id)).length === 1) {
              return '#' + CSS.escape(e.id);
            }
          } catch(err){}
        }
        
        let path = [];
        let current = e;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          let sel = current.nodeName.toLowerCase();
          if (current.id) {
            try {
              if (document.querySelectorAll('#' + CSS.escape(current.id)).length === 1) {
                sel += '#' + CSS.escape(current.id);
                path.unshift(sel);
                break;
              }
            } catch(err){}
          }
          let sibling = current;
          let nth = 1;
          while (sibling = sibling.previousElementSibling) {
            if (sibling.nodeName.toLowerCase() == sel) nth++;
          }
          if (nth !== 1) {
            sel += \`:nth-of-type(\${nth})\`;
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
        parentFormId = parentForm.getAttribute('id') || \`form_\${generateSelector(parentForm)}\`;
      }
      
      const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none' && window.getComputedStyle(el).visibility !== 'hidden';
      const isDisabled = el.disabled || el.getAttribute('aria-disabled') === 'true';
      const isEditable = el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea' || el.getAttribute('contenteditable') === 'true';
      const isClickable = el.tagName.toLowerCase() === 'button' || el.tagName.toLowerCase() === 'a' || el.getAttribute('role') === 'button' || el.onclick != null;
      
      const role = el.getAttribute('role') || el.tagName.toLowerCase();
      let elementType = 'UNKNOWN_INTERACTIVE';
      if (['input', 'textarea'].includes(el.tagName.toLowerCase())) {
        const typeAttr = el.getAttribute('type')?.toLowerCase();
        if (['checkbox'].includes(typeAttr)) elementType = 'CHECKBOX';
        else if (['radio'].includes(typeAttr)) elementType = 'RADIO';
        else if (['submit', 'button', 'reset'].includes(typeAttr)) elementType = 'BUTTON';
        else elementType = 'TEXTBOX';
      } else if (el.tagName.toLowerCase() === 'button' || role === 'button') elementType = 'BUTTON';
      else if (el.tagName.toLowerCase() === 'a' || role === 'link') elementType = 'LINK';
      else if (el.tagName.toLowerCase() === 'video') elementType = 'VIDEO';
      else if (el.tagName.toLowerCase() === 'audio') elementType = 'AUDIO';
      else if (el.tagName.toLowerCase() === 'select' || role === 'listbox' || role === 'combobox') elementType = 'DROPDOWN';
      else if (el.getAttribute('contenteditable') === 'true') elementType = 'CONTENT_EDITABLE';
      else if (role === 'menuitem') elementType = 'MENUITEM';
      else if (role === 'tab') elementType = 'TAB';
      else if (role === 'slider') elementType = 'SLIDER';
      else if (el.tagName.toLowerCase().match(/^h[1-6]$/)) elementType = 'HEADING';
      else if (el.tagName.toLowerCase() === 'p') elementType = 'PARAGRAPH';
      else if (['article', 'section'].includes(el.tagName.toLowerCase())) elementType = 'TEXT_BLOCK';
      
      const inViewport = isVisible && 
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth);

      const zIndexStr = window.getComputedStyle(el).zIndex;
      const zIndex = zIndexStr !== 'auto' ? parseInt(zIndexStr, 10) || 0 : 0;
      
      const scrollOffset = { x: window.scrollX || window.pageXOffset, y: window.scrollY || window.pageYOffset };

      return {
        // Core Universal fields
        id: id || '',
        role,
        text: (el.innerText?.trim() || el.textContent?.trim() || nearbyText).substring(0, 300),
        label: labelText,
        ariaLabel: el.getAttribute('aria-label'),
        placeholder: el.getAttribute('placeholder'),
        href: el.getAttribute('href'),
        editable: isEditable,
        clickable: isClickable,
        enabled: !isDisabled,
        visible: isVisible,
        boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        parent: el.parentElement ? generateSelector(el.parentElement) : null,
        children: Array.from(el.children).map(c => generateSelector(c)),
        
        // V2 State
        checked: el.checked !== undefined ? el.checked : (el.getAttribute('aria-checked') === 'true' ? true : (el.getAttribute('aria-checked') === 'false' ? false : null)),
        selected: el.selected !== undefined ? el.selected : (el.getAttribute('aria-selected') === 'true' ? true : (el.getAttribute('aria-selected') === 'false' ? false : null)),
        expanded: el.getAttribute('aria-expanded') === 'true' ? true : (el.getAttribute('aria-expanded') === 'false' ? false : null),
        focused: document.activeElement === el,
        readonly: el.readOnly || el.getAttribute('aria-readonly') === 'true',
        
        // V2 Geometry
        inViewport,
        scrollOffset,
        zIndex,
        
        // V2 Context
        shadowRoot: !!el.shadowRoot,
        parentGroup: el.closest('fieldset, section, [role="region"], [role="group"]')?.getAttribute('id') || null,

        // Internal fields
        selector,
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type'),
        elementType,
        name: el.getAttribute('name'),
        ariaLabelledBy: el.getAttribute('aria-labelledby'),
        value: el.value || '',
        hasAdjacentError,
        required: el.required || el.getAttribute('aria-required') === 'true',
        ariaInvalid: el.getAttribute('aria-invalid'),
        parentFormId,
      };
    });

    // ── Form Extraction ─────────────────────────────────────────────
    const formNodes = document.querySelectorAll('form');
    const forms = Array.from(formNodes).map(form => {
      const id = form.getAttribute('id');
      
      const generateSelector = (e) => {
        if (e.id) {
          try {
            if (document.querySelectorAll('#' + CSS.escape(e.id)).length === 1) {
              return '#' + CSS.escape(e.id);
            }
          } catch(err){}
        }
        let path = [];
        let current = e;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          let sel = current.nodeName.toLowerCase();
          if (current.id) {
            try {
              if (document.querySelectorAll('#' + CSS.escape(current.id)).length === 1) {
                sel += '#' + CSS.escape(current.id);
                path.unshift(sel);
                break;
              }
            } catch(err){}
          }
          let sibling = current;
          let nth = 1;
          while (sibling = sibling.previousElementSibling) {
            if (sibling.nodeName.toLowerCase() == sel) nth++;
          }
          if (nth !== 1) { sel += \`:nth-of-type(\${nth})\`; }
          path.unshift(sel);
          current = current.parentNode;
        }
        return path.join(' > ');
      };

      // Extract context elements inside the form
      let heading = form.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim() || null;
      if (!heading) {
        // Look for heading in previous siblings or parent's previous siblings
        let current = form.previousElementSibling;
        while (current) {
          if (current.tagName.match(/^H[1-6]$/)) {
            heading = current.textContent?.trim() || null;
            break;
          }
          // also check if the sibling contains a heading
          const innerH = current.querySelector('h1, h2, h3, h4, h5, h6');
          if (innerH) {
            heading = innerH.textContent?.trim() || null;
            break;
          }
          current = current.previousElementSibling;
        }
        
        // If still no heading, check parent's previous sibling
        if (!heading && form.parentElement) {
          let parentPrev = form.parentElement.previousElementSibling;
          while (parentPrev) {
            if (parentPrev.tagName.match(/^H[1-6]$/)) {
              heading = parentPrev.textContent?.trim() || null;
              break;
            }
            const innerH = parentPrev.querySelector('h1, h2, h3, h4, h5, h6');
            if (innerH) {
              heading = innerH.textContent?.trim() || null;
              break;
            }
            parentPrev = parentPrev.previousElementSibling;
          }
        }
      }
      
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

export class DOMObserver {
  async extract(page: Page): Promise<{ elements: InteractiveElement[], forms: any[] }> {
    const rawResult: { elements: any[], forms: any[] } = await page.evaluate(DOM_EXTRACTION_SCRIPT);
    
    const elements = rawResult.elements.map(el => ({
      ...el,
      id: el.id || uuid(),
      frameContext: null,
    }));

    return { elements, forms: rawResult.forms };
  }
}
