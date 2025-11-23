import {
  AttendanceMode,
  Role,
  type Talk,
  ParticipationKind,
  type TalkUserPayload,
} from "../types";
import {
  currentUser,
  users,
  sendCommand,
  currentTimeSecs,
  locations,
} from "../store";
import { EditableField } from "./ui/EditableField";
import { EditableSelect } from "./ui/EditableSelect";
import {
  formatScheduleString,
  getDurationString,
  toDate,
  toSystemTime,
} from "../utils/time";


function useTalkPermissions(talk: Talk) {
  const me = currentUser.value!;
  return {
    me,
    isCreator: me.id === talk.creator,
    isEditor: me.roles.includes(Role.Editor),
    isScheduler: me.roles.includes(Role.Scheduler),
  };
}

function useCurrentLocation(locationId: number | null) {
  return locationId != null ? locations.value[locationId] : undefined;
}


function DeleteControl({
  talkId,
  canDelete,
}: {
  talkId: number;
  canDelete: boolean;
}) {
  if (!canDelete) return null;

  const handleDelete = () => {
    if (confirm("Delete talk?")) {
      sendCommand({ RemoveTalk: { talk_id: talkId } });
    }
  };

  return (
    <div class="delete" onClick={handleDelete}>
      &#x2015;
    </div>
  );
}

function StreamIndicator({ locationId }: { locationId: number | null }) {
  const location = useCurrentLocation(locationId);

  if (!location) return null;

  return (
    <div class="stream">
      {location.live_stream ? (
        <a href={location.live_stream} target="_blank" rel="noopener noreferrer">
          <span class="emoji">📺</span> Watch Stream
        </a>
      ) : (
        <span class="no-stream">
          <span class="emoji">🚫</span> No Stream available
        </span>
      )}
    </div>
  );
}

function TalkScheduleField({
  talk,
  canEdit,
}: {
  talk: Talk;
  canEdit: boolean;
}) {
  const displayValue = talk.scheduled_at
    ? toDate(talk.scheduled_at).toISOString().slice(0, 16)
    : "";

  const handleSave = (val: string) => {
    const scheduled_at = val ? toSystemTime(new Date(val)) : null;
    sendCommand({ UpdateScheduledAt: { talk_id: talk.id, scheduled_at } });
  };

  return (
    <EditableField
      className="scheduled-at"
      type="datetime-local"
      value={displayValue}
      canEdit={canEdit}
      onSave={handleSave}
    >
      {talk.scheduled_at
        ? formatScheduleString(
          talk.scheduled_at,
          talk.duration,
          currentTimeSecs.value
        )
        : "Unscheduled"}
    </EditableField>
  );
}

function TalkDurationField({
  talk,
  canEdit,
}: {
  talk: Talk;
  canEdit: boolean;
}) {
  const mins = Math.floor(talk.duration.secs / 60).toString();

  const handleSave = (val: string) => {
    sendCommand({
      UpdateDuration: {
        talk_id: talk.id,
        duration: { secs: parseInt(val, 10) * 60, nanos: 0 },
      },
    });
  };

  return (
    <EditableField
      className="duration"
      type="number"
      value={mins}
      canEdit={canEdit}
      onSave={handleSave}
    >
      {getDurationString(
        talk.scheduled_at,
        talk.duration,
        currentTimeSecs.value
      )}
    </EditableField>
  );
}

function RoleButton({
  role,
  talk,
  myId,
}: {
  role: ParticipationKind;
  talk: Talk;
  myId: number;
}) {
  const list = role === ParticipationKind.Noob ? talk.noobs : talk.nerds;
  const isParticipating = list.includes(myId);
  const count = list.length;

  // Generate Tooltip
  const tooltip = list
    .map((id) => {
      const u = users.value[id];
      if (!u) return id.toString();
      const icon = u.attendance_mode === AttendanceMode.OnSite ? "👤" : "🌐";
      return `${icon} ${u.name} (${u.team})`;
    })
    .join(", ");

  const handleToggle = () => {
    const payload: TalkUserPayload = { talk_id: talk.id };

    // 1. Send the primary toggle command
    if (isParticipating) {
      sendCommand(
        role === ParticipationKind.Noob
          ? { RemoveNoob: payload }
          : { RemoveNerd: payload }
      );
    } else {
      sendCommand(
        role === ParticipationKind.Noob
          ? { AddNoob: payload }
          : { AddNerd: payload }
      );

      // 2. If adding, ensure we remove them from the OTHER list (exclusive roles)
      const otherList = role === ParticipationKind.Noob ? talk.nerds : talk.noobs;
      if (otherList.includes(myId)) {
        sendCommand(
          role === ParticipationKind.Noob
            ? { RemoveNerd: payload }
            : { RemoveNoob: payload }
        );
      }
    }
  };

  return (
    <button
      class={`${role} ${isParticipating ? "participating" : ""}`}
      title={tooltip}
      onClick={handleToggle}
    >
      {role.charAt(0).toUpperCase() + role.slice(1)} ({count})
    </button>
  );
}

// ==========================================
// 3. Main Component
// ==========================================

export function TalkCard({ talk }: { talk: Talk }) {
  const { me, isCreator, isEditor, isScheduler } = useTalkPermissions(talk);

  // Determine card styling based on participation
  const isParticipating =
    talk.noobs.includes(me.id) || talk.nerds.includes(me.id);
  const cardClass = `talk ${isParticipating ? "participating" : ""}`;

  // Prepare Location Options for the Select
  const locationOptions = Object.values(locations.value).map((loc) => ({
    value: loc.id,
    label: loc.name,
  }));

  return (
    <div class={cardClass}>
      <DeleteControl
        talkId={talk.id}
        canDelete={isEditor || isCreator || isScheduler}
      />

      <EditableField
        className="title"
        value={talk.title}
        canEdit={isCreator || isEditor}
        placeholder="No Title"
        onSave={(title) =>
          sendCommand({ UpdateTitle: { talk_id: talk.id, title } })
        }
      />

      <TalkScheduleField talk={talk} canEdit={isScheduler} />

      <TalkDurationField talk={talk} canEdit={isCreator || isScheduler} />

      <EditableSelect
        className="location"
        value={talk.location}
        options={locationOptions}
        canEdit={isCreator || isScheduler}
        placeholder="Unknown Location"
        onSave={(newId) =>
          sendCommand({ UpdateLocation: { talk_id: talk.id, location: newId } })
        }
      />

      <StreamIndicator locationId={talk.location} />

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
        <RoleButton role={ParticipationKind.Noob} talk={talk} myId={me.id} />
        <RoleButton role={ParticipationKind.Nerd} talk={talk} myId={me.id} />
      </div>
    </div>
  );
}