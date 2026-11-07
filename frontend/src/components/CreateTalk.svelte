<script lang="ts">
  import Dialog from './Dialog.svelte';
  import { app, sendCommand } from '../state.svelte';

  let { onclose }: { onclose: () => void } = $props();
  let title = $state('');
  let description = $state('');
  let minutes = $state(30);
  let saving = $state(false);
  let error = $state('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!title.trim() || !Number.isInteger(minutes) || minutes < 1 || !Number.isSafeInteger(minutes * 60)) return;
    if (saving) return;
    saving = true;
    error = '';
    if (await sendCommand({ AddTalk: { title: title.trim(), description, duration: { secs: minutes * 60, nanos: 0 } } })) onclose();
    else error = app.error || 'Could not save. Your draft is kept.';
    saving = false;
  }

  function cancel() {
    if (saving) return;
    if ((!title && !description && minutes === 30) || confirm('Discard this talk draft?')) onclose();
  }
</script>

<Dialog title="Create talk" onclose={cancel}>
  <form onsubmit={submit}>
    <fieldset disabled={saving}>
    <div class="heading"><h2>Create talk</h2><button class="plain" type="button" aria-label="Close creation dialog" onclick={cancel}>×</button></div>
    <label>Title<input bind:value={title} required /></label>
    <label>Description<textarea bind:value={description} rows="4"></textarea></label>
    <label>Duration in minutes<input type="number" min="1" step="1" bind:value={minutes} required /></label>
    {#if error}<p class="notice" role="alert">{error}</p>{/if}
    <div class="actions"><button type="button" onclick={cancel}>Cancel</button><button class="primary" type="submit">{saving ? 'Saving…' : 'Create talk'}</button></div>
    </fieldset>
  </form>
</Dialog>

<style>
  fieldset { display: grid; gap: 1rem; border: 0; padding: 0; margin: 0; min-width: 0; }
  .heading, .actions { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  input, textarea { width: 100%; }
  .actions { justify-content: flex-end; }
</style>
