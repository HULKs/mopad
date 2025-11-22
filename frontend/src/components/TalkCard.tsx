import type { Talk } from "../types";
import { currentUser, users, sendCommand, currentTimeSecs } from "../store";
import { EditableField } from "./ui/EditableField";
import {
  formatScheduleString,
  getDurationString,
  toDate,
  toSystemTime,
} from "../utils/time";

export function TalkCard({ talk }: { talk: Talk }) {
  const me = currentUser.value!;
  const isCreator = me.id === talk.creator;
  const isEditor = me.roles.includes("Editor");
  const isScheduler = me.roles.includes("Scheduler");

  const handleDelete = () => {
    if (confirm("Delete talk?"))
      sendCommand({ RemoveTalk: { talk_id: talk.id } });
  };

  const participationClass =
    talk.noobs.includes(me.id) || talk.nerds.includes(me.id)
      ? "participating"
      : "";

  return (
    <div class={`talk ${participationClass}`}>
      {(isEditor || isCreator || isScheduler) && (
        <div class="delete" onClick={handleDelete}>
          &#x2015;
        </div>
      )}

      {/* Title: No special formatting needed, just pass value */}
      <EditableField
        className="title"
        value={talk.title}
        canEdit={isCreator || isEditor}
        placeholder="No Title"
        onSave={(title) =>
          sendCommand({ UpdateTitle: { talk_id: talk.id, title } })
        }
      />

      {/* Schedule: Input is ISO string, View is "at YYYY-MM..." */}
      <EditableField
        className="scheduled-at"
        type="datetime-local"
        value={
          talk.scheduled_at
            ? toDate(talk.scheduled_at).toISOString().slice(0, 16)
            : ""
        }
        canEdit={isScheduler}
        onSave={(val) => {
          const scheduled_at = val ? toSystemTime(new Date(val)) : null;
          sendCommand({
            UpdateScheduledAt: { talk_id: talk.id, scheduled_at },
          });
        }}
      >
        {/* PASS CHILD HERE */}
        {talk.scheduled_at
          ? formatScheduleString(
              talk.scheduled_at,
              talk.duration,
              currentTimeSecs.value,
            )
          : "Unscheduled"}
      </EditableField>

      {/* Duration: Input is "30", View is "for 30 minutes..." */}
      <EditableField
        className="duration"
        type="number"
        value={Math.floor(talk.duration.secs / 60).toString()}
        canEdit={isCreator || isScheduler}
        onSave={(val) =>
          sendCommand({
            UpdateDuration: {
              talk_id: talk.id,
              duration: { secs: parseInt(val) * 60, nanos: 0 },
            },
          })
        }
      >
        {/* PASS CHILD HERE */}
        {getDurationString(
          talk.scheduled_at,
          talk.duration,
          currentTimeSecs.value,
        )}
      </EditableField>

      {/* Location: Input is "Room 1", View is "at Room 1" */}
      <EditableField
        className="location"
        value={talk.location || ""}
        placeholder="Unknown Location"
        canEdit={isCreator || isScheduler}
        onSave={(loc) =>
          sendCommand({
            UpdateLocation: { talk_id: talk.id, location: loc || null },
          })
        }
      >
        {/* PASS CHILD HERE */}
        at {talk.location || "unknown location"}
      </EditableField>

      {/* Description: No special formatting needed */}
      <EditableField
        className="description"
        type="textarea"
        value={talk.description}
        placeholder="No description"
        canEdit={isCreator || isEditor}
        onSave={(desc) =>
          sendCommand({
            UpdateDescription: { talk_id: talk.id, description: desc },
          })
        }
      />

      <div class="operation">
        <RoleButton role="noob" talk={talk} myId={me.id} />
        <RoleButton role="nerd" talk={talk} myId={me.id} />
      </div>
    </div>
  );
}

function RoleButton({
  role,
  talk,
  myId,
}: {
  role: "noob" | "nerd";
  talk: Talk;
  myId: number;
}) {
  // ... (RoleButton code remains exactly the same as before) ...
  const list = role === "noob" ? talk.noobs : talk.nerds;
  const isPart = list.includes(myId);
  const count = list.length;
  const tooltip = list
    .map((id) => {
      const u = users.value[id];
      return u ? `${u.name} (${u.team})` : id;
    })
    .join(", ");

  const toggle = () => {
    const cmd = isPart
      ? role === "noob"
        ? { RemoveNoob: { talk_id: talk.id, user_id: myId } }
        : { RemoveNerd: { talk_id: talk.id, user_id: myId } }
      : role === "noob"
        ? { AddNoob: { talk_id: talk.id, user_id: myId } }
        : { AddNerd: { talk_id: talk.id, user_id: myId } };

    if (!isPart) {
      const otherList = role === "noob" ? talk.nerds : talk.noobs;
      if (otherList.includes(myId)) {
        const removeOther =
          role === "noob"
            ? { RemoveNerd: { talk_id: talk.id, user_id: myId } }
            : { RemoveNoob: { talk_id: talk.id, user_id: myId } };
        sendCommand(removeOther as any);
      }
    }
    sendCommand(cmd as any);
  };

  return (
    <button
      class={`${role} ${isPart ? "participating" : ""}`}
      title={tooltip}
      onClick={toggle}
    >
      {role.charAt(0).toUpperCase() + role.slice(1)} ({count})
    </button>
  );
}
