<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Talk } from '../generated/Talk';
  import { app, sendCommand } from '../state.svelte';
  import { formatSchedule, formatDuration, toLocalInput, localCandidates, fromLocalInput, timezone } from '../utils/time';
  import Editable from './Editable.svelte';
  let { talk }: { talk: Talk } = $props();
  const creator = $derived(talk.creator === app.userId);
  const editor = $derived(app.roles.includes('Editor'));
  const scheduler = $derived(app.roles.includes('Scheduler'));
  const participating = $derived(app.userId !== null && (talk.noobs.includes(app.userId) || talk.nerds.includes(app.userId)));
  const room = $derived(talk.location === null ? undefined : app.locations[talk.location]);
  const scheduleValue = $derived(talk.scheduled_at ? toLocalInput(talk.scheduled_at) : '');
  const occurrence = $derived(talk.scheduled_at ? Math.max(0, localCandidates(scheduleValue).findIndex(t => Math.abs(t.secs_since_epoch - talk.scheduled_at!.secs_since_epoch) < 60)) : 0);
  const stream = $derived(room?.live_stream && /^https?:\/\//i.test(room.live_stream) ? room.live_stream : null);

  function tooltip(ids: number[]) {
    return ids.map(id => app.data.users[id]).filter(u => !!u)
      .sort((a, b) => Number(a.attendance_mode === 'Remote') - Number(b.attendance_mode === 'Remote') || a.name.localeCompare(b.name))
      .map(u => `${u.attendance_mode === 'Remote' ? '🌐' : '👤'} ${u.name} (${u.team})`).join('\n');
  }

  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  let longPress = false;
  function cancelPress() { clearTimeout(pressTimer); }
  function startPress(names: string) {
    cancelPress();
    longPress = false;
    pressTimer = setTimeout(() => { longPress = true; if (names) alert(names); }, 500);
  }
  onDestroy(cancelPress);

  async function toggle(role: 'Noob' | 'Nerd') {
    if (longPress) { longPress = false; return; }
    if (app.userId === null) return;
    const list = role === 'Noob' ? talk.noobs : talk.nerds;
    const payload = { talk_id: talk.id };
    if (list.includes(app.userId)) sendCommand(role === 'Noob' ? { RemoveNoob: payload } : { RemoveNerd: payload });
    else {
      const other = role === 'Noob' ? talk.nerds : talk.noobs;
      if (other.includes(app.userId) && !await sendCommand(role === 'Noob' ? { RemoveNerd: payload } : { RemoveNoob: payload })) return;
      sendCommand(role === 'Noob' ? { AddNoob: payload } : { AddNerd: payload });
    }
  }
</script>

<article class="talk" class:participating class:highlight={talk.highlight}>
  {#if creator || editor || scheduler}
    <button class="delete" aria-label={`Delete ${talk.title || 'talk'}`} title="Delete talk" onclick={() => { if (confirm('Delete talk?')) sendCommand({ RemoveTalk: { talk_id: talk.id } }); }}>−</button>
  {/if}
  <h3><Editable label="title" value={talk.title} display={talk.title || 'No title'} canEdit={creator || editor} onsave={title => sendCommand({ UpdateTitle: { talk_id: talk.id, title } })} /></h3>
  <div class="metadata">
    <Editable label={`schedule (${timezone})`} value={scheduleValue} display={talk.scheduled_at ? formatSchedule(talk.scheduled_at, talk.duration, app.now) : 'Unscheduled'} type="datetime-local" canEdit={scheduler} {occurrence}
      onsave={(v, fold) => sendCommand({ UpdateScheduledAt: { talk_id: talk.id, scheduled_at: v ? fromLocalInput(v, fold) : null } })} />
    <Editable label="duration in minutes" value={String(Math.floor(talk.duration.secs / 60))} display={formatDuration(talk.duration, talk.scheduled_at, app.now)} type="number" canEdit={creator || scheduler}
      onsave={v => sendCommand({ UpdateDuration: { talk_id: talk.id, duration: { secs: Number(v) * 60, nanos: 0 } } })} />
    {#if creator || scheduler}
      <label class="location-select">
        <span class="sr-only">Location</span>
        <select value={talk.location === null ? '' : String(talk.location)} onchange={async e => {
          const control = e.currentTarget;
          const value = control.value;
          control.disabled = true;
          await sendCommand({ UpdateLocation: { talk_id: talk.id, location: value === '' ? null : Number(value) } });
          control.value = talk.location === null ? '' : String(talk.location);
          control.disabled = false;
        }}>
          <option value="">Unknown location</option>
          {#each Object.values(app.locations) as location}<option value={String(location.id)}>At {location.name}</option>{/each}
        </select>
      </label>
    {:else}<div class="location-value">{room ? `At ${room.name}` : 'Unknown location'}</div>{/if}
    {#if room}
      <div class="stream">{#if stream}<a href={stream} target="_blank" rel="noreferrer">📺 Watch stream</a>{:else}<span>🚫 No stream available</span>{/if}</div>
    {/if}
  </div>
  <div class="description"><Editable label="description" value={talk.description} display={talk.description || 'No description'} type="textarea" canEdit={creator || editor}
    onsave={description => sendCommand({ UpdateDescription: { talk_id: talk.id, description } })} /></div>
  <div class="operations">
    <button class:chosen={talk.noobs.includes(app.userId!)} aria-pressed={talk.noobs.includes(app.userId!)} title={tooltip(talk.noobs)} ontouchstart={e => startPress(e.currentTarget.title)} ontouchend={cancelPress} ontouchcancel={cancelPress} ontouchmove={cancelPress} onclick={() => toggle('Noob')}>Noob ({talk.noobs.length})</button>
    <button class:chosen={talk.nerds.includes(app.userId!)} aria-pressed={talk.nerds.includes(app.userId!)} title={tooltip(talk.nerds)} ontouchstart={e => startPress(e.currentTarget.title)} ontouchend={cancelPress} ontouchcancel={cancelPress} ontouchmove={cancelPress} onclick={() => toggle('Nerd')}>Nerd ({talk.nerds.length})</button>
  </div>
</article>

<style>
  .talk { position: relative; background: var(--bg-card); border-radius: 1rem; padding: .9rem .6rem .75rem; box-shadow: var(--shadow-card); min-width: 0; }
  h3 { font-size: 1.2rem; line-height: 1.35; padding-right: .5rem; }
  .metadata, .description { font-size: .9rem; color: var(--text-muted); }
  .metadata { margin: .25rem 0; }
  .description { margin: .5rem 0; }
  .stream { padding: .25rem .4rem; }
  .location-select { display: block; }
  .location-select select { display: block; width: 100%; background-color: transparent; border-color: transparent; color: inherit; font: inherit; padding: .25rem .4rem; cursor: pointer; }
  .location-select select:hover { border-color: currentColor; background-color: var(--hover-surface); }
  .location-select option { background: white; color: var(--text-main); }
  .location-value { padding: .25rem .4rem; }
  .stream a { font-weight: 500; }
  .operations { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; padding: .25rem .4rem 0; }
  .operations button { border-color: var(--color-primary-light); padding: .55rem .25rem; }
  .delete { position: absolute; top: -.6rem; right: -.5rem; border: 0; background: var(--bg-card); color: var(--color-danger); width: 1.9rem; height: 1.9rem; padding: 0; border-radius: 50%; font-size: 1.5rem; box-shadow: var(--shadow-card); }
  .delete:hover { background: var(--color-danger); color: white; }
  .participating, .highlight { color: white; --hover-surface: #ffffff20; }
  .participating { background: var(--color-primary); }
  .highlight { background: #023e8a; }
  :is(.participating, .highlight) .metadata, :is(.participating, .highlight) .description, :is(.participating, .highlight) .stream a { color: #edffed; }
  :is(.participating, .highlight) .operations button { color: white; border-color: #bfe2c1; }
  :is(.participating, .highlight) .operations .chosen { background: white; color: var(--color-primary); border-color: white; }
</style>
