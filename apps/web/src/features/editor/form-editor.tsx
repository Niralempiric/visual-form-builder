"use client";

import { useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import { fieldTypes, formDefinitionLimits, formDefinitionSchema } from '@visual-form-builder/form-schema';
import type { FieldDefinition } from '@visual-form-builder/form-schema';
import { fieldRendererRegistry } from '@visual-form-builder/form-renderer';
import { fieldNames } from './store';
import type { EditorStore } from './store';

function Properties({ field, store }: { field: FieldDefinition; store: EditorStore }) {
  const state = useStore(store);
  const isLayout = field.type === 'heading' || field.type === 'description';
  const maxLabel = field.type === 'description' ? formDefinitionLimits.description : formDefinitionLimits.label;
  return <section className="editor-panel editor-properties" aria-labelledby="properties-title">
    <p className="editor-kicker">Selected field</p><h3 id="properties-title">{fieldNames[field.type]} properties</h3>
    <label htmlFor="field-label">{isLayout ? 'Text' : 'Question label'}</label>
    {field.type === 'description' ? <textarea id="field-label" value={field.label} maxLength={maxLabel} onChange={event => state.label(field.id, event.target.value)} /> :
      <input id="field-label" value={field.label} maxLength={maxLabel} onChange={event => state.label(field.id, event.target.value)} />}
    {!field.label.trim() ? <p className="editor-error">Enter a label before this field can be saved.</p> : null}
    <label htmlFor="field-help">Help text <span>(optional)</span></label>
    <textarea id="field-help" value={field.helpText} maxLength={formDefinitionLimits.helpText} onChange={event => state.help(field.id, event.target.value)} />
    {!isLayout ? <label className="editor-check"><input type="checkbox" checked={field.required} onChange={event => state.required(field.id, event.target.checked)} /> Required question</label> : null}
    {'options' in field ? <fieldset className="editor-options"><legend>Answer options</legend>
      {field.options.map((option, index) => <div className="editor-option" key={option.id}>
        <label htmlFor={'option-' + option.id}>Option {index + 1}</label>
        <div className="editor-option-row"><input id={'option-' + option.id} value={option.label} maxLength={formDefinitionLimits.label}
          onChange={event => state.optionLabel(field.id, option.id, event.target.value)} />
          <button className="editor-secondary" type="button" disabled={field.options.length <= 1} aria-label={'Remove option ' + (index + 1)}
            onClick={() => state.removeOption(field.id, option.id)}>Remove</button></div>
        {!option.label.trim() ? <p className="editor-error">Enter an option label.</p> : null}
      </div>)}
      <button className="editor-secondary" type="button" onClick={() => state.addOption(field.id)} disabled={field.options.length >= formDefinitionLimits.options}>Add option</button>
    </fieldset> : null}
  </section>;
}

export function FormEditor({ store }: { store: EditorStore }) {
  const state = useStore(store);
  const valid = useMemo(() => formDefinitionSchema.safeParse(state.definition).success, [state.definition]);
  const selected = state.definition.fields.find(field => field.id === state.selectedId);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (store.getState().dirty) { event.preventDefault(); event.returnValue = ''; } };
    const beforeNavigation = (event: MouseEvent) => {
      if (!store.getState().dirty || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest('a[href], button[data-draft-exit]') : null;
      if (!target) return;
      if (target instanceof HTMLAnchorElement) {
        if (target.target && target.target !== '_self') return;
        const url = new URL(target.href, window.location.href);
        if (url.origin === window.location.origin && url.pathname === window.location.pathname && url.search === window.location.search) return;
      }
      if (!window.confirm('Your changes are not saved. Leave this page?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', beforeNavigation, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', beforeNavigation, true); };
  }, [store]);
  return <div className="editor" aria-label="Form editor">
    <output className="editor-notice"><strong>Changes are not saved.</strong> They stay in this page only and are lost when you leave or sign out. Saving is not available yet.</output>
    {state.message ? <p className="account-error" role="alert">{state.message}</p> : null}
    {!valid ? <p className="account-error" role="alert">Review the highlighted labels and form size before saving becomes available.</p> : null}
    <div className="editor-grid">
      <section className="editor-panel editor-palette" aria-labelledby="palette-title"><p className="editor-kicker">1 · Add</p><h3 id="palette-title">Field palette</h3><p>Choose a field to add it to your form.</p>
        <div className="editor-palette-list">{fieldTypes.map(type => <button type="button" className="editor-palette-button" key={type}
          onClick={() => state.add(type)} disabled={state.definition.fields.length >= formDefinitionLimits.fields}>
          <span aria-hidden="true">+</span> {fieldNames[type]}</button>)}</div>
      </section>
      <section className="editor-panel editor-canvas" aria-labelledby="canvas-title"><p className="editor-kicker">2 · Arrange</p>
        <div className="editor-heading"><h3 id="canvas-title">Form canvas</h3><span>{state.definition.fields.length} / {formDefinitionLimits.fields}</span></div>
        <p>Select a field to edit its properties.</p>
        {state.definition.fields.length === 0 ? <div className="editor-empty"><strong>Start with a question</strong><p>Add a field from the palette to build your form.</p></div> :
          <ol className="editor-field-list">{state.definition.fields.map((field, index) => <li key={field.id}>
            <button type="button" className="editor-field" aria-pressed={field.id === state.selectedId} onClick={() => state.select(field.id)}>
              <span className="editor-field-meta">{String(index + 1).padStart(2, '0')} · {fieldNames[field.type]}</span>
              <strong>{field.label.trim() ? field.label : 'Untitled field'}</strong>
              <span>{fieldRendererRegistry[field.type].purpose === 'layout' ? 'Content block' : field.required ? 'Required question' : 'Optional question'}</span>
            </button></li>)}</ol>}
      </section>
      {selected ? <Properties key={selected.id} field={selected} store={store} /> : <section className="editor-panel editor-properties" aria-labelledby="properties-title">
        <p className="editor-kicker">3 · Edit</p><h3 id="properties-title">Field properties</h3><p>Select a field to change its label, help text and options.</p></section>}
    </div>
  </div>;
}
