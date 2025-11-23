// frontend/src/components/Scheduler.tsx
import { useRef, useState, useEffect } from "preact/hooks";
import { computed } from "@preact/signals";
import { locations, currentUser, users, talks as serverTalks, currentTimeSecs } from "../store";
import {
    isSchedulerOpen,
    draftTalks,
    saveChanges,
    discardChanges,
    updateDraftTalk,
    draggingTalkId,
    dragOffsetPx,
    SLOT_MINUTES,
    PIXELS_PER_MINUTE,
    schedulerConfig
} from "../schedulerStore";
import { toSystemTime, toDate } from "../utils/time";
import styles from "./Scheduler.module.css";
import type { Talk } from "../types";

const MINS_PER_DAY = 24 * 60;
const ZOOM = PIXELS_PER_MINUTE; // Alias for brevity

// Pre-calculate track background styles since config/zoom are static
const trackBackgroundStyle = (() => {
    const dayH = MINS_PER_DAY * ZOOM;
    const hourH = 60 * ZOOM;
    const slotH = SLOT_MINUTES * ZOOM;
    const activeStart = schedulerConfig.activeDayStartMin * ZOOM;
    const activeEnd = schedulerConfig.activeDayEndMin * ZOOM;

    // Layer 1: Day/Night Cycle (Bottom)
    const bgDayNight = `linear-gradient(
        to bottom,
        #f4f4f4 0px, #f4f4f4 ${activeStart}px,
        #ffffff ${activeStart}px, #ffffff ${activeEnd}px,
        #f4f4f4 ${activeEnd}px, #f4f4f4 ${dayH}px
    )`;
    // Layer 2: Hour Lines (Top)
    const bgHourLines = `linear-gradient(to bottom, #d9d9d9 1px, transparent 1px)`;
    // Layer 3: Slot Snap Lines (Middle, Faint)
    const bgSlotLines = `linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)`;

    return {
        backgroundImage: `${bgHourLines}, ${bgSlotLines}, ${bgDayNight}`,
        backgroundSize: `100% ${hourH}px, 100% ${slotH}px, 100% ${dayH}px`,
        backgroundRepeat: 'repeat-y'
    };
})();

/** Helper to snap a Y-coordinate to the nearest slot minute */
function getSnapMinutes(clientY: number, rectTop: number, offsetPx: number): number {
    const relativeY = clientY - rectTop - offsetPx;
    const rawMinutes = relativeY / ZOOM;
    return Math.round(rawMinutes / SLOT_MINUTES) * SLOT_MINUTES;
}

// --- Components ---

export function Scheduler() {
    if (!isSchedulerOpen.value) return null;

    const unscheduled = computed(() =>
        Object.values(draftTalks.value).filter(t => !t.scheduled_at)
    );

    return (
        <div class={styles.overlay}>
            <div class={styles.container}>
                <div class={styles.header}>
                    <h2>Scheduler</h2>
                    <div class={styles.controls}>
                        <button class={styles.cancel} onClick={discardChanges}>Cancel</button>
                        <button class={styles.save} onClick={saveChanges}>Confirm Changes</button>
                    </div>
                </div>

                <div class={styles.workspace}>
                    <Sidebar talks={unscheduled.value} />
                    <Timeline />
                </div>
            </div>
        </div>
    );
}

function Sidebar({ talks }: { talks: Talk[] }) {
    const handleDragStart = (e: DragEvent, talkId: number) => {
        draggingTalkId.value = talkId;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        dragOffsetPx.value = e.clientY - rect.top;
        e.dataTransfer?.setData("text/plain", talkId.toString());
        e.dataTransfer!.effectAllowed = "move";
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        const talkId = parseInt(e.dataTransfer?.getData("text/plain") || "0");
        if (talkId) {
            updateDraftTalk(talkId, { scheduled_at: null, location: null });
            draggingTalkId.value = null;
        }
    };

    return (
        <div class={styles.sidebar} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
            <h3 style={{ marginBottom: "0.5rem", fontSize: "1rem", fontWeight: 500 }}>Unscheduled</h3>
            <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: "1rem", fontStyle: "italic" }}>
                Drag here to unschedule
            </div>
            {talks.map(t => {
                const original = serverTalks.value[t.id] || t;
                const author = users.value[original.creator]?.name || "Unknown";
                return (
                    <div
                        key={t.id}
                        class={styles.draggableItem}
                        draggable
                        onDragStart={(e) => handleDragStart(e, t.id)}
                        onDragEnd={() => draggingTalkId.value = null}
                    >
                        <div style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>{t.title}</div>
                        <div style={{ fontSize: "0.8rem", color: "#444" }}>👤 {author}</div>
                        <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.25rem" }}>
                            ⏳ {Math.floor(t.duration.secs / 60)}m
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function Timeline() {
    const venues = computed(() => Object.values(locations.value));
    const scrollRef = useRef<HTMLDivElement>(null);
    const [shadow, setShadow] = useState<{ venueId: number; top: number; height: number; label: string } | null>(null);

    // Initial Auto-Scroll
    useEffect(() => {
        if (!scrollRef.current) return;
        const diffMins = (currentTimeSecs.value - schedulerConfig.startEpoch) / 60;
        const totalConfMins = schedulerConfig.daysToShow * MINS_PER_DAY;

        if (diffMins > 0 && diffMins < totalConfMins) {
            // Scroll to 2 hours before now
            scrollRef.current.scrollTop = Math.max(0, (diffMins - 120) * ZOOM);
        }
    }, []);

    const activeTalks = computed(() =>
        Object.values(draftTalks.value).filter(t => {
            if (!t.scheduled_at) return false;
            const start = t.scheduled_at.secs_since_epoch;
            const rangeStart = schedulerConfig.startEpoch;
            const rangeEnd = rangeStart + (schedulerConfig.daysToShow * 86400);
            return start >= rangeStart && start < rangeEnd;
        })
    );

    const handleDragOver = (e: DragEvent, venueId: number) => {
        e.preventDefault();
        const talk = draftTalks.value[draggingTalkId.value!];
        if (!talk) return;

        const totalMinutes = getSnapMinutes(e.clientY, (e.currentTarget as HTMLElement).getBoundingClientRect().top, dragOffsetPx.value);

        if (totalMinutes < 0) {
            e.dataTransfer!.dropEffect = "none";
            setShadow(null);
            return;
        }

        e.dataTransfer!.dropEffect = "move";

        // Calculate Shadow Details
        const dayIdx = Math.floor(totalMinutes / MINS_PER_DAY);
        const minsIntoDay = totalMinutes % MINS_PER_DAY;
        const timeLabel = `Day ${dayIdx + 1}, ${Math.floor(minsIntoDay / 60).toString().padStart(2, '0')}:${(minsIntoDay % 60).toString().padStart(2, '0')}`;

        setShadow({
            venueId,
            top: totalMinutes * ZOOM,
            height: (talk.duration.secs / 60) * ZOOM,
            label: timeLabel
        });
    };

    const handleDrop = (e: DragEvent, venueId: number) => {
        e.preventDefault();
        setShadow(null);
        const talkId = parseInt(e.dataTransfer?.getData("text/plain") || "0");
        if (!talkId) return;

        const totalMinutes = getSnapMinutes(e.clientY, (e.currentTarget as HTMLElement).getBoundingClientRect().top, dragOffsetPx.value);
        if (totalMinutes < 0) return;

        updateDraftTalk(talkId, {
            location: venueId,
            scheduled_at: toSystemTime(new Date((schedulerConfig.startEpoch + totalMinutes * 60) * 1000))
        });
        draggingTalkId.value = null;
    };

    // Layout Values
    const totalHeight = schedulerConfig.daysToShow * MINS_PER_DAY * ZOOM;
    const nowOffset = currentTimeSecs.value - schedulerConfig.startEpoch;
    const showRedLine = nowOffset >= 0 && nowOffset < (schedulerConfig.daysToShow * 86400);

    return (
        <div class={styles.timelineContainer}>
            <div class={styles.timelineHeader} style={{ paddingLeft: '60px' }}>
                {venues.value.map(v => (
                    <div key={v.id} class={styles.venueHeader}>{v.name}</div>
                ))}
            </div>

            <div class={styles.timelineBody} ref={scrollRef}>
                <div class={styles.timeAxis} style={{ height: `${totalHeight}px` }}>
                    {Array.from({ length: (schedulerConfig.daysToShow * MINS_PER_DAY) / 60 }).map((_, i) => (
                        <div key={i} class={styles.timeLabel} style={{ top: `${i * 60 * ZOOM}px` }}>
                            {i % 24}:00
                        </div>
                    ))}
                </div>

                <div class={styles.tracksContainer}>
                    {/* Day Separators */}
                    {Array.from({ length: schedulerConfig.daysToShow }).map((_, i) => {
                        const date = new Date((schedulerConfig.startEpoch + i * 86400) * 1000);
                        return (
                            <div key={i} class={styles.daySeparator} style={{ top: `${i * MINS_PER_DAY * ZOOM}px` }}>
                                {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </div>
                        );
                    })}

                    {/* Red "Current Time" Line */}
                    {showRedLine && (
                        <div class={styles.currentTimeLine} style={{ top: `${(nowOffset / 60) * ZOOM}px` }}>
                            <div class={styles.currentTimeKnob} />
                        </div>
                    )}

                    {/* Venues Tracks */}
                    {venues.value.map(venue => (
                        <div key={venue.id} class={styles.track} style={{ height: `${totalHeight}px`, ...trackBackgroundStyle }}
                            onDragOver={(e) => handleDragOver(e, venue.id)}
                            onDragLeave={() => setShadow(null)}
                            onDrop={(e) => handleDrop(e, venue.id)}
                        >
                            {shadow?.venueId === venue.id && (
                                <div class={styles.shadowEvent} style={{ top: `${shadow.top}px`, height: `${shadow.height - 1}px` }}>
                                    <span style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#666" }}>{shadow.label}</span>
                                </div>
                            )}
                            {activeTalks.value
                                .filter(t => t.location === venue.id)
                                .map(t => <ScheduledEvent key={t.id} talk={t} />)
                            }
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ScheduledEvent({ talk }: { talk: Talk }) {
    const startMins = (talk.scheduled_at!.secs_since_epoch - schedulerConfig.startEpoch) / 60;
    const height = (talk.duration.secs / 60) * ZOOM;
    const top = startMins * ZOOM;

    const user = currentUser.value;
    const isParticipating = user && (talk.nerds.includes(user.id) || talk.noobs.includes(user.id));
    const original = serverTalks.value[talk.id] || talk;
    const authorName = users.value[original.creator]?.name || "Unknown";

    const startDate = toDate(talk.scheduled_at!);
    const endDate = new Date(startDate.getTime() + talk.duration.secs * 1000);
    const fmtTime = (d: Date) => `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
    const timeStr = `${fmtTime(startDate)} - ${fmtTime(endDate)}`;

    const handleDragStart = (e: DragEvent) => {
        draggingTalkId.value = talk.id;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        dragOffsetPx.value = e.clientY - rect.top;
        e.dataTransfer?.setData("text/plain", talk.id.toString());
        e.dataTransfer!.effectAllowed = "move";
    };

    const handleResizeStart = (e: PointerEvent) => {
        e.stopPropagation(); e.preventDefault();
        const startY = e.pageY;
        const startHeight = height;

        const onMove = (evt: PointerEvent) => {
            const rawH = Math.max(SLOT_MINUTES * ZOOM, startHeight + (evt.pageY - startY));
            const snappedMins = Math.round((rawH / ZOOM) / SLOT_MINUTES) * SLOT_MINUTES;
            updateDraftTalk(talk.id, { duration: { secs: snappedMins * 60, nanos: 0 } });
        };
        const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    };

    return (
        <div
            class={`${styles.event} ${isParticipating ? styles.participating : ''}`}
            style={{ top: `${top}px`, height: `${height - 1}px`, opacity: draggingTalkId.value === talk.id ? 0.5 : 1 }}
            title={`${talk.title}\nBy ${authorName}\n${timeStr}`}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={() => draggingTalkId.value = null}
        >
            <div style={{ fontWeight: 600, fontSize: "0.8rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {talk.title} <span style={{ fontWeight: "normal", opacity: 0.85 }}>by {authorName}</span>
            </div>
            {height >= 40 && (
                <div style={{ fontSize: "0.75rem", opacity: 0.9, marginTop: "2px" }}>{timeStr}</div>
            )}
            <div class={styles.resizer} onPointerDown={handleResizeStart} onMouseDown={(e) => e.stopPropagation()} />
        </div>
    );
}