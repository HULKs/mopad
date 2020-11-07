import React from "react";
import CardGrid from "./CardGrid";
import {Grid, Container, Menu, Image} from "semantic-ui-react";
import firebase from "firebase";

export default function Dashboard() {
  return (
    <>
      <Menu inverted attached style={{marginBottom: "2em"}}>
        <Menu.Item header>
          <Image
            size="mini"
            src="./logo.png"
            style={{ marginRight: "1.5em" }}
          />
          MOPAD
        </Menu.Item>
        <Menu.Item as="a" position="right" onClick={() => { firebase.auth().signOut(); }}>
          Logout
        </Menu.Item>
      </Menu>
      <Container style={{width: "90%"}}>
        <CardGrid />
      </Container>
    </>
  );
}
