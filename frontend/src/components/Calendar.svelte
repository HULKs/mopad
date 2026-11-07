<script lang="ts">
  import { app } from '../state.svelte';
  import Dialog from './Dialog.svelte';
  let { onclose }: { onclose: () => void } = $props();
  let personal = $state(true);
  const link = $derived(`${location.origin}/talks.ics${personal ? `?user_id=${app.userId}` : ''}`);
</script>

<Dialog title="Subscribe talks as calendar" {onclose}>
  <div class="heading"><h2>Subscribe as calendar</h2><button class="plain" aria-label="Close calendar" onclick={onclose}>×</button></div>
  <p>Use this iCalendar / ICS address in your calendar application:</p>
  <a class="address" href={link} target="_blank" rel="noreferrer">{link}</a>
  <label class="check"><input type="checkbox" bind:checked={personal} /> Only include your NERDed and NOOBed talks</label>
  <p class="muted">Only scheduled talks appear in the calendar.</p>
</Dialog>

<style>
  .heading { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
  h2 { font-size: 1.4rem; }
  .address { display: block; overflow-wrap: anywhere; margin-bottom: 1rem; }
  p { font-size: .9rem; line-height: 1.5; }
</style>
