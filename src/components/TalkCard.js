import React from "react";
import { Card, Icon, Button } from "semantic-ui-react";

const nerd_icon = "graduation cap";
const noob_icon = "blind";

// TODO: Don't allow is_nerd && is_noob
const is_nerd = false;
const is_noob = false;

export default function TalkCard({ card }) {
  return (
    <Card raised>
      <Card.Content>
        <Card.Header>{card.title}</Card.Header>
      </Card.Content>
      <Card.Content style={{ height: 100 + "%" }}>
        <Card.Description>{card.description}</Card.Description>
      </Card.Content>
      <Card.Content>
        <Icon name={nerd_icon} />
        <b>Nerds</b>: {card.nerds.join(", ")}
        <br />
        <Icon name={noob_icon} />
        <b>Noobs</b>: {card.noobs.join(", ")}
      </Card.Content>
      <Button.Group size="mini">
        <Button toggle active={is_nerd}>
          I'm a{" "}
          <span style={{ marginLeft: 0.1 + "em" }}>
            <Icon name={nerd_icon} />
          </span>
        </Button>
        <Button.Or />
        <Button toggle active={is_noob}>
          I'm a <Icon style={{ marginLeft: 0.1 + "em" }} name={noob_icon} />
        </Button>
      </Button.Group>
    </Card>
  );
}
