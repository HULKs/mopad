import React, { useState } from "react";
import {
  Form,
  Image,
  Button,
  Menu,
  Grid,
  Header,
  Segment,
  Message,
} from "semantic-ui-react";
import { Link, useHistory } from "react-router-dom";
import firebase from "firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const history = useHistory();
  return (
    <>
      <Menu>
        <Menu.Item header>
          <Image size="mini" src="./logo.png" style={{ marginRight: "1em" }} />
          MOPAD
        </Menu.Item>
        <Menu.Item header>RoHOW 2020</Menu.Item>
      </Menu>

      <Grid
        textAlign="center"
        style={{ height: "80vh" }}
        verticalAlign="middle"
      >
        <Grid.Column style={{ maxWidth: 450 }}>
          <Header textAlign="center">Log-in to your account</Header>
          <Form>
            <Segment>
              <Form.Input
                fluid
                icon="mail"
                iconPosition="left"
                placeholder="E-mail address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Form.Input
                fluid
                icon="lock"
                iconPosition="left"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <Button
                fluid
                color="green"
                onClick={async () => {
                  try {
                    await firebase
                      .auth()
                      .signInWithEmailAndPassword(email, password);
                    history.replace("/");
                  } catch (error) {
                    // TODO: error dialog
                    alert(`${error.code}\n\n${error.message}`);
                  }
                }}
              >
                Login
              </Button>
            </Segment>
          </Form>
          <Message>
            New to us? <Link to="/register">Register</Link>
          </Message>
        </Grid.Column>
      </Grid>
    </>
  );
}
