import React from "react";
import { Card } from "semantic-ui-react";
import TalkCard from "./TalkCard";
import EditableCard from "./EditableCard";

export default function CardGrid({ cards }) {
  return (
    <Card.Group>
      {cards.map((card) => (
        <TalkCard card={card} />
      ))}
      <EditableCard />
    </Card.Group>
  );
}
