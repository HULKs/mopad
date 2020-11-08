import React from "react";
import { Card } from "semantic-ui-react";
import TalkCard from "./TalkCard";
import EditableCard from "./EditableCard";

export default function CardGrid({ user, users, talks }) {
  return (
    <Card.Group stackable>
      {Object
        .keys(talks)
        .map((talkId) => <TalkCard
          key={talkId}
          talkId={talkId}
          talk={talks[talkId]}
          user={user}
          users={users}
        />)
      }
      <EditableCard user={user} />
    </Card.Group>
  );
}
