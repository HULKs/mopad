import React from "react";
import "semantic-ui-css/semantic.min.css";
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";
import {
  List,
  Segment,
  Card,
  Icon,
  Image,
  Button,
  Label,
  Grid,
} from "semantic-ui-react";

const nerd_icon = "graduation cap";
const noob_icon = "blind";

// TODO: Don't allow is_nerd && is_noob
const is_nerd = false;
const is_noob = false;

function TalkCard({ card }) {
  return (
    <Card>
      <Card.Content header={card.title} />
      <Card.Content description={card.description} />
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

function CardGrid({ cards }) {
  return (
    <List horizontal>
      {cards.map((card) => (
        <List.Item>
          <TalkCard card={card} />
        </List.Item>
      ))}
    </List>
  );
}

function Page() {
  const example_card = {
    title: "My second Talk",
    description: "I am a description of a talk!",
    nerds: ["TotallyNotThorsten", "Thomas"],
    noobs: ["Yuria", "Lasse", "Maxi"],
  };
  const cards = [example_card, example_card, example_card];
  return (
    <Segment placeholder>
      <CardGrid cards={cards} />
    </Segment>
  );
}

export default function App() {
  return <Page />;
}
