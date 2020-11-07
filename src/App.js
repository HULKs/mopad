import React from "react";
import "semantic-ui-css/semantic.min.css";
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";
import {
  List,
  Segment,
  Card,
  Icon,
  Input,
  TextArea,
  Form,
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

function EditableCard() {
  return (
    <Card inverted>
      <Card.Content>
        <Card.Header>
          <Input transparent fluid placeholder="Talk Topic..." />
        </Card.Header>
      </Card.Content>
      <Card.Content>
        <Card.Description>
          <Form>
            <TextArea placeholder="What's your talk about?" />
          </Form>
        </Card.Description>
      </Card.Content>
      <Card.Content>
        <Button>Create</Button>
      </Card.Content>
    </Card>
  );
}

function CardGrid({ cards }) {
  return (
    <Card.Group>
      {cards.map((card) => (
        <TalkCard card={card} />
      ))}
      <EditableCard />
    </Card.Group>
  );
}

function Page() {
  const example_card = {
    title: "My second Talk",
    description: "I am a description of a talk!",
    nerds: ["TotallyNotThorsten", "Thomas"],
    noobs: ["Yuria", "Lasse", "Maxi"],
  };
  const long_card = {
    title: "My second Talk",
    description:
      "I am adsfasd fsadfasdfasfdasdfasdf asdf asd fas df asd fsa df askg;sajg sa;lkg sagljsadlkf jdsa;lfjldsa;f j;lkdsa jf;lsajf ;lksajf ;lkdsa jf;lsajlkjsldjg;ls jg;lksd g;lkdsjg lkdsjg  a description of a talk!",
    nerds: ["TotallyNotThorsten", "Thomas"],
    noobs: ["Yuria", "Lasse", "Maxi"],
  };
  const cards = [
    example_card,
    example_card,
    example_card,
    long_card,
    example_card,
    example_card,
    example_card,
    example_card,
    example_card,
  ];
  return (
    <Segment placeholder>
      <CardGrid cards={cards} />
    </Segment>
  );
}

export default function App() {
  return <Page />;
}
