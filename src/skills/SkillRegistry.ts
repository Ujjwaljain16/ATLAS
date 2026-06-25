import { Skill, SkillContext, SkillResult } from './types';

export class SkillRegistry {
  private registry: Map<string, Skill> = new Map();

  register(skill: Skill): void {
    this.registry.set(skill.name, skill);
    console.log(`[SkillRegistry] Registered skill: ${skill.name}`);
  }

  getAll(): Skill[] {
    return Array.from(this.registry.values());
  }

  getDescriptions(): Array<{ name: string; description: string; metadata?: any }> {
    return this.getAll().map(s => ({ 
      name: s.name, 
      description: s.description,
      metadata: s.metadata 
    }));
  }

  async invoke(name: string, params: any, ctx: SkillContext): Promise<SkillResult> {
    const skill = this.registry.get(name);
    if (!skill) {
      return {
        status: 'FAILED',
        success: false,
        data: null,
        stepsExecuted: 0,
        duration: 0,
        failureReason: `Skill "${name}" not found in registry. Available skills: ${Array.from(this.registry.keys()).join(', ')}`
      };
    }

    try {
      console.log(`[SkillRegistry] Invoking skill: ${name}`, params);
      const result = await skill.execute(params, ctx);
      console.log(`[SkillRegistry] Skill ${name} completed. Success: ${result.success}, Steps: ${result.stepsExecuted}`);
      return result;
    } catch (err: any) {
      console.error(`[SkillRegistry] Skill ${name} threw an error:`, err.message);
      return {
        status: 'FAILED',
        success: false,
        data: null,
        stepsExecuted: 0,
        duration: 0,
        failureReason: `Skill ${name} threw: ${err.message}`
      };
    }
  }
}
