import React from "react";
import CardGrid from "./CardGrid";
import { Segment, Header, Icon } from "semantic-ui-react";
import firebase from "firebase";

export default function Dashboard() {
  return (
    <>
      <Segment clearing>
        <Header as="h1" floated="left">
          <Icon name="blind" size="medium" />
          <Header.Content>MOPAD</Header.Content>
        </Header>
        <Header floated="right" block onClick={() => {
          firebase.auth().signOut();
        }}>
          Logout
        </Header>
      </Segment>
      <CardGrid />
    </>
  );
}
