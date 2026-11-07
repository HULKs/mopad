<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import type { Talk } from '../generated/Talk';
  import { app, sendCommand } from '../state.svelte';
  import { toLocalInput, localCandidates, fromLocalInput, utcOffset, timezone } from '../utils/time';
  import { audienceLabel, eventDays, draftChanges, fitsEvent, layoutTalks, openingPeriods, timelineBands, zoomTimeline, SLOT_MINUTES, type EventLayout } from '../schedule';
  import Dialog from './Dialog.svelte';

  let { onclose }: { onclose: () => void } = $props();
  const config = $derived(app.config!);
  const original = app.scheduler!.original;
  const draft = app.scheduler!.draft;
  const days = $derived(eventDays(config));
  let dayValue = $state(untrack(() => (days.find(d => d.start <= app.now && app.now < d.end) ?? days[0]).value));
  const day = $derived(days.find(d => d.value === dayValue) ?? days[0]);
  const rooms = $derived(Object.values(app.locations));
  let viewportHeight = $state(0);
  let headingHeight = $state(0);
  let viewMinutes = $state<number | null>(360);
  const dayMinutes = $derived((day.end - day.start) / 60);
  const visibleMinutes = $derived(Math.min(dayMinutes, Math.max(Math.min(60, dayMinutes), viewMinutes ?? dayMinutes)));
  const timeHeight = $derived(Math.max(1, viewportHeight - headingHeight));
  const zoom = $derived(timeHeight / visibleMinutes);
  const height = $derived(dayMinutes * zoom);
  const tickMinutes = $derived(visibleMinutes <= 120 ? 15 : visibleMinutes <= 480 ? 30 : 60);
  const ticks = $derived(Array.from({ length: Math.ceil(dayMinutes / tickMinutes) }, (_, i) => day.start + i * tickMinutes * 60));
  const bands = $derived(timelineBands(config, day.start, day.end));
  const openingEdges = $derived(openingPeriods(config).flatMap(r => [
    { time: r.start, label: 'Opens' },
    { time: r.end, label: 'Closes' },
  ]).filter(edge => edge.time >= day.start && edge.time < day.end));
  const unscheduled = $derived(Object.values(draft).filter(t => !t.scheduled_at || t.location === null || !app.locations[t.location] || !fitsEvent(t, config)));
  const changes = $derived(draftChanges(original, draft));
  const changedTalks = $derived(new Set(changes.map(c => (Object.values(c)[0] as { talk_id: number }).talk_id)).size);

  let dragging = $state<{ id: number; offset: number } | null>(null);
  let shadow = $state<{ room: number; start: number; id: number } | null>(null);
  let resizing = $state<{ id: number; y: number; secs: number } | null>(null);
  let selectedId = $state<number | null>(null);
  let startValue = $state('');
  let roomValue = $state('');
  let durationValue = $state(30);
  let occurrence = $state(0);
  let error = $state('');
  let detailDirty = $state(false);
  let saving = $state(false);
  let timeline = $state<HTMLDivElement>();
  const candidates = $derived(startValue ? localCandidates(startValue) : []);

  function visible(t: Talk, room: number) {
    return t.location === room && t.scheduled_at !== null && t.scheduled_at.secs_since_epoch < day.end && t.scheduled_at.secs_since_epoch + t.duration.secs > day.start;
  }

  // Column widths depend on committed draft placement, never the hover preview.
  const occupied = $derived(new Set(rooms.filter(r => Object.values(draft).some(t => visible(t, r.id))).map(r => r.id)));
  const gridColumns = $derived(`5.5rem ${rooms.map(r => occupied.has(r.id) ? 'minmax(15rem, 3fr)' : 'minmax(6rem, 1fr)').join(' ')}`);
  const gridMinWidth = $derived(`${5.5 + occupied.size * 15 + (rooms.length - occupied.size) * 6}rem`);
  const previewTalks = $derived(shadow
    ? [...Object.values(draft).filter(t => t.id !== shadow!.id), { ...draft[shadow.id], location: shadow.room, scheduled_at: { secs_since_epoch: shadow.start, nanos_since_epoch: 0 } }]
    : Object.values(draft));
  const layouts = $derived(Object.fromEntries(rooms.map(r => [r.id, layoutTalks(previewTalks.filter(t => t.location === r.id), day.start, day.end)])));

  let previousDay = '';
  let previousZoom = 0;
  $effect(() => {
    const { start, end, value } = day;
    const scale = zoom;
    if (!timeline || timeHeight <= 1) return;
    if (previousDay !== value) {
      const now = untrack(() => app.now);
      timeline.scrollTop = now >= start && now < end ? Math.max(0, (now - start - 3600) / 60 * scale) : 0;
    } else if (previousZoom) timeline.scrollTop *= scale / previousZoom;
    previousDay = value;
    previousZoom = scale;
  });

  async function changeZoom(requestedMinutes: number, anchorY: number) {
    if (!timeline || timeHeight <= 1 || dragging || resizing) return;
    const next = zoomTimeline(visibleMinutes, requestedMinutes, dayMinutes, timeHeight, timeline.scrollTop, anchorY);
    viewMinutes = next.minutes === dayMinutes ? null : next.minutes;
    await tick();
    if (timeline) timeline.scrollTop = next.scrollTop;
  }

  function wheelZoom(event: WheelEvent) {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? timeHeight : 1);
    const anchor = Math.max(0, Math.min(timeHeight, event.clientY - timeline!.getBoundingClientRect().top - headingHeight));
    void changeZoom(visibleMinutes * Math.exp(delta / 400), anchor);
  }

  function keyZoom(event: KeyboardEvent) {
    if (!timeline?.contains(document.activeElement)) return;
    if (!event.ctrlKey || !['+', '=', '-', '0'].includes(event.key)) return;
    event.preventDefault();
    const minutes = event.key === '0' ? dayMinutes : visibleMinutes * (event.key === '-' ? 1.25 : .8);
    void changeZoom(minutes, timeHeight / 2);
  }

  onMount(() => {
    const element = timeline!;
    element.addEventListener('wheel', wheelZoom, { passive: false });
    return () => element.removeEventListener('wheel', wheelZoom);
  });

  function select(talk: Talk) {
    if (detailDirty && !applyDetails()) return;
    talk = draft[talk.id];
    selectedId = talk.id;
    startValue = talk.scheduled_at ? toLocalInput(talk.scheduled_at) : toLocalInput({ secs_since_epoch: day.start, nanos_since_epoch: 0 });
    occurrence = talk.scheduled_at ? Math.max(0, localCandidates(startValue).findIndex(t => Math.abs(t.secs_since_epoch - talk.scheduled_at!.secs_since_epoch) < 60)) : 0;
    durationValue = talk.duration.secs / 60;
    roomValue = String(talk.location ?? rooms[0]?.id ?? '');
    error = '';
    detailDirty = false;
  }

  function change(id: number, patch: Partial<Talk>): boolean {
    const next = { ...draft[id], ...patch };
    if (!Number.isSafeInteger(next.duration.secs) || next.duration.secs < 60 || !fitsEvent(next, config)) {
      error = 'Keep the whole talk inside the event, with a duration of at least one minute.';
      return false;
    }
    draft[id] = next;
    error = '';
    return true;
  }

  function applyForm(event: SubmitEvent) {
    event.preventDefault();
    applyDetails();
  }

  function applyDetails(): boolean {
    if (selectedId === null || !roomValue || !Number.isInteger(durationValue)) { error = 'Choose a room and a whole number of minutes.'; return false; }
    try {
      const applied = change(selectedId, {
        scheduled_at: fromLocalInput(startValue, occurrence, draft[selectedId].scheduled_at),
        location: Number(roomValue), duration: { secs: durationValue * 60, nanos: 0 },
      });
      if (applied) detailDirty = false;
      return applied;
    } catch (e) { error = e instanceof Error ? e.message : 'Invalid local time'; return false; }
  }

  function unschedule(id: number) {
    draft[id] = { ...draft[id], scheduled_at: null, location: null };
    if (selectedId === id) selectedId = null;
    detailDirty = false;
  }

  function dragStart(event: DragEvent, talk: Talk, offset = 0) {
    if (detailDirty && !applyDetails()) { event.preventDefault(); return; }
    dragging = { id: talk.id, offset };
    selectedId = null;
    event.dataTransfer!.setData('text/plain', String(talk.id));
    event.dataTransfer!.effectAllowed = 'move';
    const image = document.createElement('canvas');
    image.width = image.height = 1;
    event.dataTransfer!.setDragImage(image, 0, 0);
  }

  function dragOver(event: DragEvent, room: number) {
    if (!dragging) return;
    event.preventDefault();
    const top = (event.currentTarget as HTMLElement).getBoundingClientRect().top;
    const seconds = day.start + (event.clientY - top - dragging.offset) / zoom * 60;
    const slot = SLOT_MINUTES * 60;
    const start = Math.round(seconds / slot) * slot;
    const talk = draft[dragging.id];
    if (start < day.start || start >= day.end || !fitsEvent({ ...talk, scheduled_at: { secs_since_epoch: start, nanos_since_epoch: 0 } }, config)) {
      shadow = null;
      event.dataTransfer!.dropEffect = 'none';
      return;
    }
    event.dataTransfer!.dropEffect = 'move';
    shadow = { room, start, id: talk.id };
  }

  function drop(event: DragEvent, room: number) {
    event.preventDefault();
    if (shadow?.room === room) change(shadow.id, { scheduled_at: { secs_since_epoch: shadow.start, nanos_since_epoch: 0 }, location: room });
    dragging = null;
    shadow = null;
  }

  function resizeStart(event: PointerEvent, talk: Talk) {
    event.stopPropagation();
    event.preventDefault();
    if (detailDirty && !applyDetails()) return;
    talk = draft[talk.id];
    resizing = { id: talk.id, y: event.clientY, secs: talk.duration.secs };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function resizeMove(event: PointerEvent) {
    if (!resizing) return;
    const minutes = Math.max(SLOT_MINUTES, Math.round((resizing.secs / 60 + (event.clientY - resizing.y) / zoom) / SLOT_MINUTES) * SLOT_MINUTES);
    if (change(resizing.id, { duration: { secs: minutes * 60, nanos: 0 } }) && selectedId === resizing.id) durationValue = minutes;
  }

  function resizeKey(event: KeyboardEvent, talk: Talk) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const secs = Math.max(60, talk.duration.secs + (event.key === 'ArrowUp' ? -1 : 1) * SLOT_MINUTES * 60);
      if (change(talk.id, { duration: { secs, nanos: 0 } }) && selectedId === talk.id) durationValue = secs / 60;
    } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(talk); }
  }

  async function save() {
    if (saving || (detailDirty && !applyDetails())) return;
    const commands = draftChanges(original, draft);
    for (const command of commands) {
      const { talk_id: id } = Object.values(command)[0] as { talk_id: number };
      if (!app.data.talks[id]) { error = 'A changed talk was deleted. Cancel and reopen to refresh.'; return; }
      if (!fitsEvent(draft[id], app.config!)) { error = 'The event range changed. Adjust the changed talks before saving.'; return; }
    }
    saving = true;
    // shortcut: talks save individually; use a server batch only if the whole schedule must be atomic.
    for (const command of commands) {
      if (!await sendCommand(command)) { saving = false; error = `${app.error || 'Could not save.'} Your remaining draft is kept.`; return; }
      if ('ScheduleTalk' in command) {
        const { talk_id, after } = command.ScheduleTalk;
        original[talk_id] = { ...original[talk_id], ...$state.snapshot(after) };
      }
    }
    saving = false;
    onclose();
  }

  function layout(talk: Talk, room: number): EventLayout {
    return layouts[room].find(e => e.talk.id === talk.id) ?? {
      talk, start: Math.max(day.start, talk.scheduled_at!.secs_since_epoch),
      end: Math.min(day.end, talk.scheduled_at!.secs_since_epoch + talk.duration.secs), column: 0, columns: 1,
    };
  }

  function position(event: EventLayout) {
    return `top:${(event.start - day.start) / 60 * zoom}px;height:${Math.max(2, eventHeight(event) - 2)}px;left:calc(${event.column / event.columns * 100}% + 3px);width:calc(${100 / event.columns}% - 6px)`;
  }

  function eventHeight(event: EventLayout) { return (event.end - event.start) / 60 * zoom; }
  function participating(t: Talk) { const live = app.data.talks[t.id] ?? t; return app.userId !== null && (live.noobs.includes(app.userId) || live.nerds.includes(app.userId)); }
  function audience(t: Talk) { return audienceLabel(app.data.talks[t.id] ?? t, app.data.users); }
  function timeLabel(epoch: number) { return new Date(epoch * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  function axisLabel(epoch: number) { return new Date(epoch * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }); }
  function requested(t: Talk) { return (app.data.talks[t.id]?.creator_duration ?? t.creator_duration ?? t.duration).secs / 60; }
  function durationLabel(t: Talk) { return `${t.duration.secs / 60} min${t.duration.secs / 60 !== requested(t) ? ` · requested ${requested(t)} min` : ''}`; }
  function cancel() { if (!saving && ((!changes.length && !detailDirty) || confirm('Discard unsaved scheduling changes?'))) onclose(); }
</script>

<svelte:window onkeydown={keyZoom} onpointermove={resizeMove} onpointerup={() => resizing = null} onpointercancel={() => resizing = null} />

<Dialog title="Scheduler" wide onclose={cancel}>
  <div class="scheduler">
    <span id="scheduler-resize-help" class="sr-only">Up/Down adjusts by 15 minutes; Enter opens details.</span>
    <header>
      <div class="identity"><h2>Scheduler</h2><small>{timezone}</small></div>
      <label class="day-picker">Day<select bind:value={dayValue}>{#each days as d}<option value={d.value}>{d.label}</option>{/each}</select></label>
      <div class="actions"><button onclick={cancel} disabled={saving}>Cancel</button><button class="primary" onclick={save} disabled={saving}>{saving ? 'Saving…' : `Save schedule${changedTalks ? ` (${changedTalks})` : ''}`}</button></div>
    </header>
    <div class="legend"><span><i class="closed-key"></i> Outside opening hours</span><span><i class="break-key"></i> Break</span><div class="zoom-controls" aria-label="Timeline zoom"><button aria-label="Zoom in timeline" onclick={() => changeZoom(visibleMinutes * .8, timeHeight / 2)}>+</button><button aria-label="Zoom out timeline" onclick={() => changeZoom(visibleMinutes * 1.25, timeHeight / 2)}>−</button><button onclick={() => changeZoom(dayMinutes, timeHeight / 2)}>Fit day</button></div></div>
    {#if error}<p class="notice" role="alert">{error}</p>{/if}

    <div class="workspace" inert={saving}>
      <aside aria-label="Talks and scheduling details" ondragover={e => { if (dragging) e.preventDefault(); }} ondrop={e => { e.preventDefault(); if (dragging) unschedule(dragging.id); dragging = null; shadow = null; }}>
        {#if selectedId !== null && draft[selectedId]}
          {@const selected = draft[selectedId]}
          <form onsubmit={applyForm} oninput={() => detailDirty = true}>
            <div class="panel-heading"><h3>Talk details</h3><button class="plain" type="button" aria-label="Close talk details" onclick={() => { if (!detailDirty || applyDetails()) selectedId = null; }}>×</button></div>
            <strong class="selected-title">{selected.title || 'Untitled talk'}</strong>
            <p class="audience">{audience(selected)}</p>
            <p class="creator">{app.data.users[selected.creator]?.name ?? 'Unknown'}<br />Creator requested <strong>{requested(selected)} min</strong></p>
            <label>Start ({timezone})<input type="datetime-local" bind:value={startValue} oninput={() => occurrence = 0} required /></label>
            {#if candidates.length > 1}<label>Time occurrence<select bind:value={occurrence}>{#each candidates as candidate, i}<option value={i}>{i === 0 ? 'Earlier' : 'Later'} ({utcOffset(candidate)})</option>{/each}</select></label>{/if}
            <label>Scheduled duration (minutes)<input type="number" min="1" step="1" bind:value={durationValue} required /></label>
            <label>Room<select bind:value={roomValue} required>{#each rooms as room}<option value={String(room.id)}>{room.name}</option>{/each}</select></label>
            <button class="primary" type="submit">Apply to draft</button>
            <button type="button" onclick={() => unschedule(selectedId!)}>Unschedule</button>
          </form>
        {/if}

        <div class="panel-heading"><h3>Unscheduled</h3><span class="count">{unscheduled.length}</span></div>
        {#each unscheduled as talk (talk.id)}
          <button class="unscheduled" class:highlight={talk.highlight} class:selected={selectedId === talk.id} draggable="true" ondragstart={e => dragStart(e, talk)} ondragend={() => { dragging = null; shadow = null; }} onclick={() => select(talk)}>
            <strong>{talk.title || 'Untitled talk'}</strong>
            <span class="audience">{audience(talk)}</span>
            <span>{app.data.users[talk.creator]?.name ?? 'Unknown'}</span>
            <span class:adjusted={talk.duration.secs / 60 !== requested(talk)}>{durationLabel(talk)}</span>
          </button>
        {/each}
      </aside>

      <div class="timeline" role="region" aria-label="Scheduling timeline" bind:this={timeline} bind:clientHeight={viewportHeight}>
        {#if !rooms.length}<p class="notice">No rooms configured. Add locations to locations.json before scheduling.</p>{/if}
        <div class="grid" style={`grid-template-columns:${gridColumns};min-width:${gridMinWidth};--heading-height:${headingHeight}px`}>
          <div class="corner" bind:offsetHeight={headingHeight}>Local time</div>
          {#each rooms as room}<div class="room-heading" class:empty={!occupied.has(room.id)}><strong>{room.name}</strong>{#if !occupied.has(room.id)}<small>Empty</small>{/if}</div>{/each}
          <div class="axis" style={`height:${height}px`}>
            {#if app.now >= day.start && app.now < day.end}<span class="sr-only">Current time {axisLabel(app.now)}</span>{/if}
            {#each ticks as time}<span class="time-label" style={`top:${(time - day.start) / 60 * zoom}px`}>{axisLabel(time)}</span>{/each}
            {#each bands.filter(b => b.kind === 'break') as band}
              <div class="break-range" style={`top:${(band.start - day.start) / 60 * zoom}px;height:${(band.end - band.start) / 60 * zoom}px`}>
                <div class="break-caption"><strong>{band.label}</strong><span>{timeLabel(band.start)}–{timeLabel(band.end)}</span></div>
              </div>
            {/each}
            {#each openingEdges as edge}<span class="edge-caption" style={`top:${(edge.time - day.start) / 60 * zoom}px`}>{edge.label} {timeLabel(edge.time)}</span>{/each}
          </div>

          <div class="background" style={`height:${height}px`} aria-hidden="true">
            {#each bands as band}<div class="band" class:closed={band.kind === 'closed'} class:pause={band.kind === 'break'} style={`top:${(band.start - day.start) / 60 * zoom}px;height:${(band.end - band.start) / 60 * zoom}px`}></div>{/each}
            {#each openingEdges as edge}<div class="opening-edge" style={`top:${(edge.time - day.start) / 60 * zoom}px`}></div>{/each}
            {#if app.now >= day.start && app.now < day.end}<div class="now" style={`top:${(app.now - day.start) / 60 * zoom}px`}></div>{/if}
          </div>

          {#each rooms as room, column}
            <div class="track" class:empty={!occupied.has(room.id)} role="group" aria-label={room.name}
              style={`grid-column:${column + 2};height:${height}px;background-size:100% ${60 * zoom}px,100% ${SLOT_MINUTES * zoom}px`}
              ondragover={e => dragOver(e, room.id)}
              ondragleave={e => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) shadow = null; }}
              ondrop={e => drop(e, room.id)}>

              {#each Object.values(draft).filter(t => visible(t, room.id)) as talk (talk.id)}
                {@const item = layout(talk, room.id)}
                <div class="event" class:highlight={talk.highlight} class:participating={participating(talk)} class:changed={changes.some(c => (Object.values(c)[0] as { talk_id: number }).talk_id === talk.id)}
                  class:drag-origin={dragging?.id === talk.id && shadow !== null} class:dragging={dragging?.id === talk.id}
                  style={position(item)} draggable="true" role="group" aria-label={talk.title}
                  ondragstart={e => dragStart(e, talk, e.clientY - (e.currentTarget as HTMLElement).getBoundingClientRect().top)}
                  ondragend={() => { dragging = null; shadow = null; }}>
                  <button class="event-content" aria-label={`${talk.title || 'Untitled talk'} · ${audience(talk)} · ${durationLabel(talk)}`} onclick={() => select(talk)} title={`${talk.title}\n${audience(talk)}\n${timeLabel(talk.scheduled_at!.secs_since_epoch)}–${timeLabel(talk.scheduled_at!.secs_since_epoch + talk.duration.secs)}\n${durationLabel(talk)}\n${app.data.users[talk.creator]?.name ?? 'Unknown'}`}>
                    {#if eventHeight(item) >= 26}<strong>{talk.title || 'Untitled talk'}</strong>{/if}
                    {#if eventHeight(item) >= 44}<span class="audience">{audience(talk)}</span>{/if}
                    {#if eventHeight(item) >= 64}<span>{timeLabel(talk.scheduled_at!.secs_since_epoch)}–{timeLabel(talk.scheduled_at!.secs_since_epoch + talk.duration.secs)}</span>{/if}
                    {#if eventHeight(item) >= 80}<span class:adjusted={talk.duration.secs / 60 !== requested(talk)}>{durationLabel(talk)}</span>{/if}
                    {#if eventHeight(item) >= 112}<span>{app.data.users[talk.creator]?.name ?? 'Unknown'}</span>{/if}
                  </button>
                  {#if talk.scheduled_at!.secs_since_epoch + talk.duration.secs <= day.end}
                    <button class="resize" aria-label={`Resize ${talk.title} duration`} aria-describedby="scheduler-resize-help" draggable="false" onpointerdown={e => resizeStart(e, talk)} onkeydown={e => resizeKey(e, talk)}></button>
                  {/if}
                </div>
              {/each}

              {#if shadow?.room === room.id}
                {@const preview = layouts[room.id].find(e => e.talk.id === shadow!.id)!}
                <div class="event ghost" style={position(preview)} aria-hidden="true">{#if eventHeight(preview) >= 26}<strong>{preview.talk.title}</strong>{/if}{#if eventHeight(preview) >= 44}<span class="audience">{audience(preview.talk)}</span>{/if}{#if eventHeight(preview) >= 64}<span>{timeLabel(shadow.start)} · {durationLabel(preview.talk)}</span>{/if}</div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</Dialog>

<style>
  .scheduler { height: 100%; display: flex; flex-direction: column; background: white; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.25rem; border-bottom: 1px solid #d9e2da; flex-wrap: wrap; }
  h2 { font-size: 1.5rem; }
  .identity small { display: block; margin-top: .25rem; }
  .day-picker { display: flex; align-items: center; gap: .5rem; }
  .actions { display: flex; gap: .5rem; }
  header button, header select { border-radius: .5rem; }
  .legend { display: flex; gap: 1rem; flex-wrap: wrap; padding: .6rem 1.25rem; font-size: .75rem; color: var(--text-muted); border-bottom: 1px solid #e1e7e2; }
  .legend span { display: inline-flex; align-items: center; gap: .4rem; }
  .legend i { width: .8rem; height: .8rem; border-radius: .15rem; }
  .zoom-controls { display: flex; gap: .35rem; margin-left: auto; }
  .zoom-controls button { padding: .2rem .5rem; }
  .closed-key { background: #dce2de; }
  .break-key { background: #fbe7b4; }
  .workspace { display: flex; flex: 1; min-height: 0; }
  aside { width: 18rem; flex-shrink: 0; padding: 1rem; overflow-y: auto; border-right: 1px solid #d9e2da; background: #f6f8f6; }
  .panel-heading { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin-bottom: .75rem; }
  .panel-heading h3 { font-size: 1rem; }
  .panel-heading button { padding: 0 .35rem; font-size: 1.4rem; }
  .count { border-radius: 1rem; padding: .15rem .5rem; font-size: .8rem; background: #e1e9e2; }
  form { display: grid; gap: .75rem; padding-bottom: 1rem; margin-bottom: 1rem; border-bottom: 1px solid #d9e2da; }
  .selected-title { overflow-wrap: anywhere; line-height: 1.4; }
  .creator { margin: 0; color: var(--text-muted); font-size: .8rem; line-height: 1.5; }
  .audience { margin: 0; font-size: .8rem; font-weight: 500 !important; }
  input, select { width: 100%; }
  .unscheduled { display: grid; gap: .3rem; width: 100%; padding: .75rem; margin-bottom: .6rem; background: white; color: var(--text-main); text-align: left; border-color: #d5dfd7; border-radius: .6rem; cursor: grab; }
  .unscheduled:hover, .unscheduled.selected { border-color: var(--color-primary); box-shadow: var(--shadow-card); }
  .unscheduled span { font-size: .8rem; color: var(--text-muted); font-weight: 400; }
  .adjusted { font-weight: 500 !important; text-decoration: underline dotted; text-underline-offset: 3px; }
  .timeline { flex: 1; overflow: auto; position: relative; min-width: 0; }
  .grid { display: grid; width: 100%; isolation: isolate; }
  .corner, .room-heading { position: sticky; top: 0; z-index: 6; background: #eef3ef; border-right: 1px solid #d9e2da; border-bottom: 1px solid #ccd8ce; padding: .75rem .5rem; font-size: .85rem; text-align: center; }
  .room-heading { display: flex; flex-direction: column; justify-content: center; min-width: 0; overflow-wrap: anywhere; }
  .room-heading small { margin-top: .2rem; font-size: .7rem; }
  .corner { left: 0; z-index: 7; }
  .axis { position: sticky; left: 0; grid-column: 1; grid-row: 2; z-index: 5; background: white; border-right: 1px solid #ccd8ce; }
  .time-label { position: absolute; right: .35rem; font-size: .65rem; color: var(--text-muted); white-space: nowrap; padding-top: .15rem; }
  .break-range { position: absolute; inset-inline: 0; pointer-events: none; }
  .break-caption { position: sticky; top: var(--heading-height); padding: 2px; background: #fff1ce; color: #685016; text-align: center; font-size: .65rem; line-height: 11px; }
  .break-caption strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .break-caption span { display: block; font-size: .6rem; }
  .edge-caption { position: absolute; inset-inline: 0; padding: 2px; background: #f0f5f0; color: #496b4e; text-align: center; font-size: .65rem; white-space: nowrap; }
  .background { position: relative; grid-column: 2 / -1; grid-row: 2; pointer-events: none; }
  .track { position: relative; grid-row: 2; border-right: 1px solid #d9e2da; background-image: linear-gradient(to bottom, #cbd7ce 1px, transparent 1px), linear-gradient(to bottom, #edf0ed 1px, transparent 1px); }
  .band { position: absolute; inset-inline: 0; pointer-events: none; overflow: hidden; }
  .closed { background: repeating-linear-gradient(135deg, #dce2de88, #dce2de88 5px, #e8ece988 5px, #e8ece988 10px); }
  .pause { background: #fbe7b499; }
  .opening-edge { position: absolute; inset-inline: 0; border-top: 1px dashed #79957d; pointer-events: none; z-index: 1; }
  .event { position: absolute; border-radius: .35rem; border: 1px solid #b5cbb9; background: #eff7f0; overflow: hidden; z-index: 2; }
  .event.changed { border-left: 3px solid #d19516; }
  .event:hover, .event:focus-within { box-shadow: 0 2px 7px #0003; z-index: 3; }
  .event-content { display: flex; flex-direction: column; gap: 2px; width: 100%; height: 100%; color: inherit; text-align: left; padding: 2px 5px 8px; border: 0; border-radius: 0; overflow: hidden; cursor: grab; }
  .event-content strong, .ghost strong { display: block; flex-shrink: 0; width: 100%; font-size: .78rem; line-height: 14px; font-weight: 500; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .event-content span, .ghost span { display: block; flex-shrink: 0; font-size: .7rem; line-height: 13px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .participating { background: var(--color-primary); color: white; border-color: #24772a; }
  .event.highlight, .unscheduled.highlight { background: #023e8a; color: white; border-color: #023e8a; }
  .unscheduled.highlight span { color: #edffed; }
  .dragging { opacity: .4; }
  .event.drag-origin { opacity: 0; pointer-events: none; }
  .resize { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 7px; min-height: 0; padding: 0; border: 0; border-radius: 0; background: #0001; color: inherit; cursor: ns-resize; touch-action: none; }
  .resize::after { content: ''; display: block; width: 1.25rem; max-width: 50%; height: 2px; background: currentColor; opacity: .45; border-radius: 1px; margin: auto; }
  .resize:hover, .resize:focus-visible { background: #0003; }
  .ghost { border: 2px dashed var(--color-primary); background: #e0f0e3ed; color: var(--text-main); pointer-events: none; padding: 3px 5px; z-index: 4; }
  .now { position: absolute; inset-inline: 0; height: 2px; background: var(--color-danger); pointer-events: none; z-index: 1; }
  .notice { margin: 0; font-size: .85rem; }
  @media (max-width: 42rem) {
    header { padding: .75rem; gap: .75rem; }
    .identity { width: 100%; }
    .identity small { font-size: .7rem; }
    .day-picker { flex: 1 0 100%; }
    .actions { width: 100%; justify-content: space-between; }
    .legend { padding: .5rem .75rem; gap: .5rem .75rem; font-size: .65rem; }
    .workspace { flex-direction: column; }
    aside { width: 100%; max-height: 35%; border-right: 0; border-bottom: 1px solid #d9e2da; padding: .75rem; }
    .timeline { min-height: 12rem; }
  }
</style>
