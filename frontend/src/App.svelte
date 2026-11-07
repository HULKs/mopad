<script lang="ts">
  import { onMount } from 'svelte';
  import { app, start, stop } from './state.svelte';
  import Auth from './components/Auth.svelte';
  import TalkList from './components/TalkList.svelte';
  import Footer from './components/Footer.svelte';

  onMount(() => {
    void start();
    const clock = setInterval(() => app.now = Math.floor(Date.now() / 1000), 30000);
    return () => { clearInterval(clock); stop(); };
  });
</script>

{#if app.error}
  <div class="notice error" role="alert">
    <span>{app.error}</span>
    <button class="plain" onclick={() => app.error = ''} aria-label="Dismiss error">×</button>
  </div>
{/if}

{#if !app.config}
  <main class="welcome">
    <h1>MOPAD</h1>
    {#if app.error}<button onclick={() => void start()}>Retry connection</button>
    {:else}<p role="status">Loading event…</p>{/if}
  </main>
{:else if app.userId !== null && app.data.users[app.userId]}
  {#if app.authenticating || app.connection !== 'connected'}<div class="notice" role="status">Connection lost. Reconnecting… Your drafts are kept.</div>{/if}
  <TalkList />
{:else if (app.authenticating && app.restoring) || app.userId !== null}
  <main class="welcome"><h1>MOPAD</h1><p role="status">{app.connection === 'disconnected' ? 'Connection lost. Reconnecting…' : 'Signing in…'}</p></main>
{:else}
  <Auth />
{/if}

<Footer />
