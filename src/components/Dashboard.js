import React from "react";
import CardGrid from "./CardGrid";
import {Container, Menu, Image} from "semantic-ui-react";
import firebase from "firebase";

export default function Dashboard({ user, users, talks }) {
  return (
    <>
      <Menu attached style={{marginBottom: "2em"}}>
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
        <CardGrid user={user} users={users} talks={talks} />
      </Container>
    </>
  );
}
