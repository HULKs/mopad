<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  let { title, wide = false, onclose, children }: { title: string; wide?: boolean; onclose: () => void; children: Snippet } = $props();
  let dialog: HTMLDialogElement;
  onMount(() => { dialog.showModal(); });
</script>

<dialog bind:this={dialog} class:wide aria-label={title} oncancel={e => { e.preventDefault(); onclose(); }} onclick={e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onclose(); } }}>
  {@render children()}
</dialog>

<style>
  dialog { border: 0; border-radius: 1rem; padding: 1.5rem; width: min(28rem, calc(100vw - 2rem)); max-height: 90dvh; color: var(--text-main); box-shadow: 0 .5rem 2rem #0004; }
  dialog::backdrop { background: #0008; }
  dialog.wide { width: 96vw; max-width: none; height: 92dvh; padding: 0; overflow: hidden; }
</style>
