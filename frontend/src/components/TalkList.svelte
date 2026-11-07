<script lang="ts">
  import { app, sendCommand, logout } from '../state.svelte';
  import { timezone } from '../utils/time';
  import TalkCard from './TalkCard.svelte';
  import Calendar from './Calendar.svelte';
  import Scheduler from './Scheduler.svelte';
  import CreateTalk from './CreateTalk.svelte';
  const me = $derived(app.data.users[app.userId!]);
  const sorted = $derived(Object.values(app.data.talks).sort((a, b) => (a.scheduled_at?.secs_since_epoch ?? Infinity) - (b.scheduled_at?.secs_since_epoch ?? Infinity) || a.id - b.id));
  const sections = $derived([
    { title: 'Past talks', talks: sorted.filter(t => t.scheduled_at && app.now >= t.scheduled_at.secs_since_epoch + t.duration.secs) },
    { title: 'Current talks', talks: sorted.filter(t => t.scheduled_at && t.scheduled_at.secs_since_epoch <= app.now && app.now < t.scheduled_at.secs_since_epoch + t.duration.secs) },
    { title: 'Upcoming talks', talks: sorted.filter(t => t.scheduled_at && t.scheduled_at.secs_since_epoch > app.now) },
    { title: 'Unscheduled talks', talks: sorted.filter(t => !t.scheduled_at) },
  ]);
  let collapsed = $state<Record<string, boolean>>({ 'Past talks': true });
  let calendar = $state(false);
  let creating = $state(false);

  function openScheduler() {
    const original = $state.snapshot(app.data.talks);
    app.scheduler = { original, draft: structuredClone(original) };
  }

</script>

<main class="talk-list">
  <header>
    <div><h1>MOPAD</h1><p class="muted">{me.name} · {me.team}</p></div>
    <nav aria-label="Event controls">
      {#if app.roles.includes('Scheduler')}<button class="primary" onclick={openScheduler}>Open scheduler</button>{/if}
      <button class="secondary" onclick={() => calendar = true}>Calendar subscription</button>
      <label class="check attendance"><input type="checkbox" checked={me.attendance_mode === 'Remote'} onchange={async e => {
        const control = e.currentTarget;
        control.disabled = true;
        await sendCommand({ SetAttendanceMode: { attendance_mode: control.checked ? 'Remote' : 'OnSite' } });
        control.checked = me.attendance_mode === 'Remote';
        control.disabled = false;
      }} /> Participating remotely</label>
      <button class="secondary" onclick={logout}>Log out</button>
    </nav>
  </header>
  <p class="timezone">All times in {timezone}.</p>
  {#each sections as section (section.title)}
    {#if section.talks.length}
      <section aria-label={section.title}>
        <div class="section-heading">
          <h2>{section.title} <span>({section.talks.length})</span></h2>
          <button aria-expanded={!collapsed[section.title]} onclick={() => collapsed[section.title] = !collapsed[section.title]}>{collapsed[section.title] ? 'Show' : 'Hide'}</button>
        </div>
        {#if !collapsed[section.title]}
          <div class="talk-grid">{#each section.talks as talk (talk.id)}<TalkCard {talk} />{/each}</div>
        {/if}
      </section>
    {/if}
  {/each}
  {#if !sorted.length}<p class="empty">No talks yet. Add one to get the conversation started.</p>{/if}
  <button class="add" aria-label="Create talk" onclick={() => creating = true}>+</button>
</main>
{#if calendar}<Calendar onclose={() => calendar = false} />{/if}
{#if creating}<CreateTalk onclose={() => creating = false} />{/if}
{#if app.scheduler && app.roles.includes('Scheduler')}<Scheduler onclose={() => app.scheduler = null} />{/if}

<style>
  .talk-list { max-width: 100rem; margin: auto; padding: 1.5rem; }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap; }
  h1 { font-size: 2.5rem; }
  header p { margin: .25rem 0; }
  nav { display: flex; align-items: center; justify-content: flex-end; gap: .5rem; flex-wrap: wrap; }
  nav button, .attendance { min-height: 2.5rem; border-radius: .5rem; padding: .6rem .8rem; font-size: .85rem; }
  .secondary { background: var(--bg-card); color: var(--text-main); border-color: #ccd7ce; }
  .secondary:hover { border-color: var(--color-primary); background: #eaf3eb; }
  .attendance { background: #e8eee9; color: var(--text-muted); }
  .timezone { color: var(--text-muted); font-size: .8rem; margin: 1rem 0 1.5rem; }
  section { margin: 1.5rem 0; }
  .section-heading { display: flex; justify-content: space-between; align-items: center; margin: 1rem 0; gap: .5rem; }
  h2 { font-size: 1.25rem; }
  h2 span { color: var(--text-muted); font-size: 1rem; font-weight: 400; }
  .section-heading button { padding: .4rem .8rem; }
  .talk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr)); gap: 1.25rem; align-items: start; }
  .add { position: fixed; right: 1.25rem; bottom: 1.25rem; z-index: 2; border-radius: 50%; width: 4rem; height: 4rem; padding: 0; font-size: 2rem; color: white; background: var(--color-primary); box-shadow: 0 .3rem 1rem #0004; }
  .empty { text-align: center; padding: 4rem 1rem; color: var(--text-muted); }
  @media (max-width: 40rem) { .talk-list { padding: 1rem; } nav { justify-content: flex-start; gap: .75rem; } }
</style>
