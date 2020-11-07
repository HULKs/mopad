import React from "react";
import CardGrid from "./CardGrid";
import { Menu, Image } from "semantic-ui-react";
import firebase from "firebase";

export default function Dashboard() {
  return (
    <>
      <Menu inverted>
        <Menu.Item header>
          <Image
            size="mini"
            src="./logo.png"
            style={{ marginRight: "1.5em" }}
          />
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
      <CardGrid />
    </>
  );
}