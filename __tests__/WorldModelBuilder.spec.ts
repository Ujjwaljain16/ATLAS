import { describe, it, expect } from 'vitest';
import { WorldModelBuilder } from '../src/worldmodel/WorldModelBuilder';

describe('WorldModelBuilder', () => {
  it('should correctly structure fields into forms', () => {
    const builder = new WorldModelBuilder();
    const inventory = [
      {
        tag: 'input',
        type: 'text',
        id: 'username',
        name: 'username',
        ariaLabel: null,
        ariaLabelledBy: null,
        placeholder: 'Username',
        value: '',
        labelText: 'Username',
        nearbyText: '',
        hasAdjacentError: false,
        visible: true,
        disabled: false,
        required: true,
        ariaInvalid: null,
        boundingBox: { x: 0, y: 0, width: 10, height: 10 },
        role: 'textbox',
        parentFormId: 'form-1',
        selector: '#username',
        elementId: 'elem-1',
        frameContext: null
      },
      {
        tag: 'input',
        type: 'password',
        id: 'password',
        name: 'password',
        ariaLabel: null,
        ariaLabelledBy: null,
        placeholder: 'Password',
        value: '',
        labelText: 'Password',
        nearbyText: '',
        hasAdjacentError: false,
        visible: true,
        disabled: false,
        required: true,
        ariaInvalid: null,
        boundingBox: { x: 0, y: 20, width: 10, height: 10 },
        role: 'textbox',
        parentFormId: 'form-1',
        selector: '#password',
        elementId: 'elem-2',
        frameContext: null
      }
    ];

    const state = builder.build({ url: 'http://localhost', elementInventory: inventory } as any, 'Login');
    
    expect(state.forms.length).toBeGreaterThan(0);
    expect(state.forms[0].formId).toBe('form-1');
    expect(state.forms[0].fields.length).toBe(2);
    expect(state.forms[0].fields[0].label).toBe('Username');
    expect(state.forms[0].fields[1].label).toBe('Password');
  });
});
