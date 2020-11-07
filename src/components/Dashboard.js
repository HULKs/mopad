import React from "react";
import CardGrid from "./CardGrid";
import { Header, Segment, Icon } from "semantic-ui-react";

export default function Dashboard() {
  return (
    <>
      <Segment clearing>
        <Header as="h1" floated="left">
          <Icon name="blind" size="medium" />
          <Header.Content>MOPAD</Header.Content>
        </Header>
        <Header floated="right" block href="/login">
          Logout
        </Header>
      </Segment>
      <CardGrid />
    </>
  );
}
