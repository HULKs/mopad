<script lang="ts">
  import { app, authenticate } from '../state.svelte';
  let register = $state(false);
  let name = $state('');
  let password = $state('');
  let team = $state(app.teams[0] ?? '');
  let remote = $state(false);
  let notNao = $state(false);

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim() || !team || !password || (register && !notNao)) return;
    authenticate(register
      ? { Register: { name: name.trim(), team, password, attendance_mode: remote ? 'Remote' : 'OnSite' } }
      : { Login: { name: name.trim(), team, password } });
  }
</script>

<main class="welcome">
  <h1>MOPAD</h1>
  <p class="tagline">Moderated Organization PAD<br /><span>powerful, agile, distributed</span></p>
  <form onsubmit={submit}>
    <h2>{register ? 'Register' : 'Login'}</h2>
    <label>Your name<input bind:value={name} autocomplete="username" required /></label>
    {#if register}<small>Unique in your team, visible to everyone.</small>{/if}
    <label>Team<select bind:value={team} required>
      {#each app.teams as t}<option value={t}>{t}</option>{/each}
    </select></label>
    <label>Password<input type="password" bind:value={password} autocomplete={register ? 'new-password' : 'current-password'} required /></label>
    {#if register}
      <label class="check"><input type="checkbox" bind:checked={remote} /> Remote participation only</label>
      <label class="check"><input type="checkbox" bind:checked={notNao} required /> I'm not a NAO</label>
    {/if}
    <button class="primary" type="submit" disabled={app.authenticating || !team || (register && !notNao)}>{app.authenticating ? 'Signing in…' : register ? 'Register' : 'Login'}</button>
    <p>{register ? 'Already have an account?' : "Don't have an account?"}
      <button class="link" type="button" disabled={app.authenticating} onclick={() => { register = !register; app.error = ''; }}>{register ? 'Login' : 'Register'}</button>
    </p>
  </form>
</main>

<style>
  .tagline { color: var(--text-muted); line-height: 1.5; }
  .tagline span { font-size: .8rem; }
  form { width: min(21rem, 100%); display: grid; gap: 1rem; text-align: left; }
  form h2, form p { text-align: center; }
  form p { margin: 0; font-size: .9rem; }
  small { margin-top: -.7rem; }
</style>
