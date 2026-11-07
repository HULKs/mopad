<script lang="ts">
  import { tick } from 'svelte';
  import { localCandidates, utcOffset } from '../utils/time';
  let { value, label, display = value || 'Not set', canEdit = false, type = 'text', occurrence = 0, onsave }: {
    value: string; label: string; display?: string; canEdit?: boolean;
    type?: 'text' | 'textarea' | 'number' | 'datetime-local';
    occurrence?: number;
    onsave: (value: string, occurrence: number) => Promise<boolean>;
  } = $props();
  let editing = $state(false);
  let draft = $state('');
  let selectedOccurrence = $state(0);
  let error = $state('');
  let saving = $state(false);
  let control = $state<HTMLInputElement | HTMLTextAreaElement>();
  let editor = $state<HTMLDivElement>();
  const candidates = $derived(type === 'datetime-local' && draft ? localCandidates(draft) : []);

  async function edit() {
    draft = value;
    selectedOccurrence = occurrence;
    error = '';
    editing = true;
    await tick();
    control?.focus();
    if (control instanceof HTMLInputElement && type === 'text') control.select();
  }

  async function save() {
    if (!editing || saving) return;
    if (draft === value && selectedOccurrence === occurrence) { editing = false; return; }
    if (type === 'number' && (!Number.isSafeInteger(Number(draft) * 60) || !Number.isInteger(Number(draft)) || Number(draft) < 1)) { error = 'Enter a positive whole number of minutes.'; return; }
    if (label === 'title' && !draft.trim()) { error = 'Enter a title.'; return; }
    if (type === 'datetime-local' && draft && !candidates.length) { error = 'This local time does not exist. Check the daylight-saving change.'; return; }
    saving = true;
    try {
      if (await onsave(draft, selectedOccurrence)) editing = false;
      else error = 'Not saved. Check the error above and try again.';
    } catch (e) { error = e instanceof Error ? e.message : 'Could not save'; }
    finally { saving = false; }
  }

  function keydown(event: KeyboardEvent) {
    if (saving) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); editing = false; }
    else if (event.key === 'Enter' && type !== 'textarea') { event.preventDefault(); save(); }
  }

  function blur(event: FocusEvent) {
    if (!editor?.contains(event.relatedTarget as Node | null)) save();
  }
</script>

{#if editing}
  <div class="editor" bind:this={editor} onfocusout={blur}>
    <fieldset disabled={saving}>
    <label>
      <span class="sr-only">{label}</span>
      {#if type === 'textarea'}
        <textarea bind:this={control} bind:value={draft} onkeydown={keydown} rows="4"></textarea>
      {:else if type === 'number'}
        <input bind:this={control} type="number" bind:value={() => draft, v => draft = String(v ?? '')} min="1" step="1" onkeydown={keydown} />
      {:else if type === 'datetime-local'}
        <input bind:this={control} type="datetime-local" bind:value={draft} oninput={() => selectedOccurrence = 0} onkeydown={keydown} />
      {:else}
        <input bind:this={control} bind:value={draft} onkeydown={keydown} />
      {/if}
    </label>
    {#if candidates.length > 1}
      <label class="occurrence">This time occurs twice
        <select bind:value={selectedOccurrence}>{#each candidates as candidate, i}<option value={i}>{i === 0 ? 'Earlier' : 'Later'} ({utcOffset(candidate)})</option>{/each}</select>
      </label>
    {/if}
    {#if error}<small class="field-error" role="alert">{error}</small>{/if}
    </fieldset>
  </div>
{:else if canEdit}
  <button class="editable" aria-label={`Edit ${label}: ${display}`} onclick={edit}>{display}</button>
{:else}
  <div class="value">{display}</div>
{/if}

<style>
  .editable, .value { display: block; width: 100%; text-align: left; font: inherit; color: inherit; padding: .25rem .4rem; border: 0; border-radius: .3rem; overflow-wrap: anywhere; white-space: pre-wrap; }
  .editable { background: transparent; text-transform: none; }
  .editable:hover { background: var(--hover-surface); }
  .editor { padding: .25rem .4rem; color: var(--text-main); }
  fieldset { margin: 0; padding: 0; border: 0; min-width: 0; }
  input, select, textarea { width: 100%; }
  .occurrence { padding: .5rem; background: var(--bg-card); font-size: .8rem; }
</style>
