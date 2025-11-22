import { computed } from "@preact/signals";
import { useState } from "preact/hooks";
import { talks, currentTimeSecs, sendCommand, currentUser } from "../store";
import { TalkCard } from "./TalkCard";
import { type Talk } from "../types";

export function TalkList() {
  const user = currentUser.value!;

  const sortedTalks = computed(() => Object.values(talks.value));

  // Buckets
  const unscheduled = computed(() =>
    sortedTalks.value.filter((t) => !t.scheduled_at),
  );

  const scheduled = computed(() =>
    sortedTalks.value
      .filter((t) => !!t.scheduled_at)
      .sort(
        (a, b) =>
          a.scheduled_at!.secs_since_epoch - b.scheduled_at!.secs_since_epoch,
      ),
  );

  const past = computed(() =>
    scheduled.value.filter((t) => {
      const end = t.scheduled_at!.secs_since_epoch + t.duration.secs;
      return currentTimeSecs.value >= end;
    }),
  );

  const current = computed(() =>
    scheduled.value.filter((t) => {
      const start = t.scheduled_at!.secs_since_epoch;
      const end = start + t.duration.secs;
      return currentTimeSecs.value >= start && currentTimeSecs.value < end;
    }),
  );

  const upcoming = computed(() =>
    scheduled.value.filter((t) => {
      const start = t.scheduled_at!.secs_since_epoch;
      return currentTimeSecs.value < start;
    }),
  );

  const addTalk = () => {
    sendCommand({
      AddTalk: {
        title: `The talk from ${user.name}`,
        description:
          "You can change the title, duration, and description by clicking on them",
        duration: { secs: 30 * 60, nanos: 0 },
      },
    });
  };

  return (
    <div id="talks">
      <Header />
      <Section title="Past talks" list={past.value} defaultOpen={false} />
      <Section title="Current talks" list={current.value} defaultOpen={true} />
      <Section
        title="Upcoming talks"
        list={upcoming.value}
        defaultOpen={true}
      />
      <Section
        title="Unscheduled talks"
        list={unscheduled.value}
        defaultOpen={true}
      />

      <div class="add" onClick={addTalk}>
        +
      </div>
      <CalendarDialog />
      <Footer />
    </div>
  );
}

function Section({
  title,
  list,
  defaultOpen,
}: {
  title: string;
  list: Talk[];
  defaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  if (list.length === 0) return null;

  return (
    <>
      <div class="heading">
        <h2>{title}</h2>
        <button onClick={() => setIsOpen(!isOpen)}>
          {isOpen
            ? `Hide ${title.split(" ")[0]}`
            : `Show ${list.length} ${title.split(" ")[0]}`}
        </button>
      </div>
      {isOpen && (
        <div class="talks">
          {list.map((t) => (
            <TalkCard key={t.id} talk={t} />
          ))}
        </div>
      )}
    </>
  );
}

function Header() {
  return (
    <div class="title">
      <h1>MOPAD</h1>
      <a
        class="calendar"
        href="#calendar"
        onClick={(e) => {
          e.preventDefault();
          const dialog = document.querySelector(".calendar-dialog");
          dialog?.classList.add("open");
        }}
      >
        Subscribe as calendar
      </a>
    </div>
  );
}

function CalendarDialog() {
  const [personal, setPersonal] = useState(true);
  const uid = currentUser.value?.id;
  const link = `${window.location.protocol}//${window.location.host}/talks.ics${personal ? `?user_id=${uid}` : ""}`;

  return (
    <div
      class="calendar-dialog"
      onClick={(e) =>
        e.currentTarget === e.target && e.currentTarget.classList.remove("open")
      }
    >
      <div class="box">
        <h1>Subscribe talks as calendar</h1>
        <h2>Nerds might know it as iCalendar/ICS</h2>
        <div class="description">
          Use this address in external calendar applications:
        </div>
        <a href={link} target="_blank">
          {link}
        </a>
        <div class="personalization">
          <input
            type="checkbox"
            checked={personal}
            onChange={(e) => setPersonal(e.currentTarget.checked)}
          />
          <label>Only include your NERDed and NOOBed talks</label>
        </div>
        <div class="hint">The calendar will only contain scheduled talks.</div>
      </div>
    </div>
  );
}

function Footer() {
  const handleLogout = (e: Event) => {
    e.preventDefault();
    // Clear local storage and reload to force a clean disconnect/reset
    localStorage.removeItem("reloginToken");
    window.location.reload();
  };

  return (
    <div class="footer">
      <a href="#logout" onClick={handleLogout}>
        Logout from MOPAD
      </a>
      <br />
      <a href="https://rohow.de/2025/de/imprint.html" target="_blank">
        Imprint/Impressum
      </a>
      <br />
      <a href="https://rohow.de/2025/de/privacy_policy.html" target="_blank">
        Privacy Policy/Datenschutzerklärung
      </a>
    </div>
  );
}
