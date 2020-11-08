import React from "react";
import { Menu, Image } from "semantic-ui-react";
import firebase from "firebase";

export default function DashboardMenu() {
  return (
    <Menu attached style={{ marginBottom: "2em" }}>
      <Menu.Item header>
        <Image size="mini" src="./logo.png" style={{ marginRight: "1.5em" }} />
        MOPAD
      </Menu.Item>
      <Menu.Item
        as="a"
        position="right"
        onClick={() => {
          firebase.auth().signOut();
        }}
      >
        Logout
      </Menu.Item>
    </Menu>
  );
}
