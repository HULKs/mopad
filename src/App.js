import React from "react";
import CardGrid from "./components/CardGrid";
import { Segment } from "semantic-ui-react";

function Dashboard() {
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
      <CardGrid />
    </Segment>
  );
}

export default function App() {
  return <Dashboard />;
}
