import React from "react";
import { Card } from "semantic-ui-react";
import TalkCard from "./TalkCard";
import EditableCard from "./EditableCard";

export default function CardGrid({ user, users, talks }) {
  const scheduledTalkIds = Object.keys(talks)
    .filter((talkId) => "scheduled_at" in talks[talkId])
    .sort(
      (talkIdA, talkIdB) =>
        talks[talkIdA].scheduled_at.toMillis() >
        talks[talkIdB].scheduled_at.toMillis()
    );
  const unscheduledTalkIds = Object.keys(talks)
    .filter((talkId) => !("scheduled_at" in talks[talkId]))
    .sort(
      (talkIdA, talkIdB) =>
        talks[talkIdA].created_at.toMillis() >
        talks[talkIdB].created_at.toMillis()
    );

  return (
    <Card.Group stackable>
      {scheduledTalkIds.map((talkId) => (
        <TalkCard
          key={talkId}
          talkId={talkId}
          talk={talks[talkId]}
          user={user}
          users={users}
        />
      ))}
      {unscheduledTalkIds.map((talkId) => (
        <TalkCard
          key={talkId}
          talkId={talkId}
          talk={talks[talkId]}
          user={user}
          users={users}
        />
      ))}
      <EditableCard user={user} />
    </Card.Group>
  );
}
