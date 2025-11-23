import { signal } from "@preact/signals";
import { talks, sendCommand } from "./store";
import type { Talk } from "./types";

export const schedulerConfig = {
    // The starting timestamp of the conference (00:00 of the first day)
    // currently set to: 2025-11-23T00:00:00
    startEpoch: new Date("2025-11-23T00:00:00").getTime() / 1000,
    
    // How many days to render on the vertical timeline
    daysToShow: 3,
    
    // Day/Night Cycle for Gray Zones (Minutes from midnight)
    activeDayStartMin: 8 * 60,  // 08:00
    activeDayEndMin: 22 * 60,   // 22:00
};

export const SLOT_MINUTES = 15;
export const PIXELS_PER_MINUTE = 1.1;


export const isSchedulerOpen = signal(false);
export const draftTalks = signal<Record<number, Talk>>({});
export const draggingTalkId = signal<number | null>(null);
export const dragOffsetPx = signal(0);


export function openScheduler() {
    draftTalks.value = JSON.parse(JSON.stringify(talks.value));
    isSchedulerOpen.value = true;
}

export function discardChanges() {
    isSchedulerOpen.value = false;
    draftTalks.value = {};
}

export function saveChanges() {
    const original = talks.value;
    const draft = draftTalks.value;

    Object.values(draft).forEach((dTalk) => {
        const oTalk = original[dTalk.id];
        if (!oTalk) return;

        if (dTalk.location !== oTalk.location) {
            sendCommand({ UpdateLocation: { talk_id: dTalk.id, location: dTalk.location } });
        }

        const dTime = dTalk.scheduled_at?.secs_since_epoch;
        const oTime = oTalk.scheduled_at?.secs_since_epoch;
        if (dTime !== oTime) {
            sendCommand({ UpdateScheduledAt: { talk_id: dTalk.id, scheduled_at: dTalk.scheduled_at } });
        }

        if (dTalk.duration.secs !== oTalk.duration.secs) {
            sendCommand({ UpdateDuration: { talk_id: dTalk.id, duration: dTalk.duration } });
        }
    });

    isSchedulerOpen.value = false;
}

export function updateDraftTalk(id: number, changes: Partial<Talk>) {
    const t = draftTalks.value[id];
    if (t) {
        draftTalks.value = { ...draftTalks.value, [id]: { ...t, ...changes } };
    }
}