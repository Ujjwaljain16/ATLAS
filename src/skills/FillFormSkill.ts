import { Skill, SkillContext, SkillResult } from './types';
import { InteractiveElement } from '../shared/types';

interface FillEntry {
  fieldLabel: string;
  value: string;
}

interface FieldFillStatus {
  fieldLabel: string;
  filled: boolean;
  elementId?: string;
  errorMessage?: string;
}

interface FillFormSkillParams {
  fields: FillEntry[];
}

/**
 * FillFormSkill — Fills a form by matching {fieldLabel → value} pairs to discovered elements.
 * Transparent to the Memory Layer: each action is executed through the tool runtime.
 */
export class FillFormSkill implements Skill {
  name = 'FillFormSkill';
  description = 'Fills a form using a list of {fieldLabel, value} pairs. Discovers each input by its label/placeholder, fills it, and returns per-field success status.';

  async execute(params: FillFormSkillParams, ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    let stepsExecuted = 0;
    const statuses: FieldFillStatus[] = [];

    const elements = await ctx.observe();
    stepsExecuted++;

    for (const entry of params.fields) {
      const input = this.findInputByLabel(elements, entry.fieldLabel);
      if (!input) {
        statuses.push({ fieldLabel: entry.fieldLabel, filled: false, errorMessage: `No element found matching label "${entry.fieldLabel}"` });
        continue;
      }

      // Click to focus
      const clickResult = await ctx.toolRuntime.execute({
        name: 'click_on_screen',
        params: { elementId: input.id }
      }, ctx.browser);
      stepsExecuted++;

      if (!clickResult.success) {
        statuses.push({ fieldLabel: entry.fieldLabel, filled: false, elementId: input.id, errorMessage: `Focus click failed: ${clickResult.error?.message}` });
        continue;
      }

      // Type the value
      const typeResult = await ctx.toolRuntime.execute({
        name: 'send_keys',
        params: { elementId: input.id, text: entry.value, pressEnterAfter: false }
      }, ctx.browser);
      stepsExecuted++;

      if (!typeResult.success) {
        statuses.push({ fieldLabel: entry.fieldLabel, filled: false, elementId: input.id, errorMessage: `Type failed: ${typeResult.error?.message}` });
        continue;
      }

      // Blur to trigger validation
      await ctx.toolRuntime.execute({ name: 'press_key', params: { key: 'Tab' } }, ctx.browser);
      stepsExecuted++;

      statuses.push({ fieldLabel: entry.fieldLabel, filled: true, elementId: input.id });
    }

    const allFilled = statuses.every(s => s.filled);
    return {
      status: allFilled ? 'SUCCESS' : 'FAILED',
      success: allFilled,
      data: { statuses },
      stepsExecuted,
      duration: Date.now() - start,
      failureReason: allFilled ? undefined : `Some fields failed: ${statuses.filter(s => !s.filled).map(s => s.fieldLabel).join(', ')}`
    };
  }

  private findInputByLabel(elements: InteractiveElement[], label: string): InteractiveElement | null {
    const normalised = label.toLowerCase().trim();
    return elements.find(e =>
      e.visible && e.enabled && e.editable &&
      (e.elementType === 'TEXTBOX' || e.elementType === 'TEXTAREA' || e.tag === 'input' || e.tag === 'textarea') &&
      (
        e.label?.toLowerCase().includes(normalised) ||
        e.ariaLabel?.toLowerCase().includes(normalised) ||
        e.placeholder?.toLowerCase().includes(normalised) ||
        e.name?.toLowerCase().includes(normalised) ||
        e.text?.toLowerCase().includes(normalised)
      )
    ) ?? null;
  }
}
