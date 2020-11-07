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
import {
  Link,
  useHistory,
} from "react-router-dom";
import firebase from "firebase";

export default function Register() {
  const [name, setName] = useState("");
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
        <Menu.Item header>
          RoHOW 2020
        </Menu.Item>
      </Menu>

      <Grid textAlign="center" style={{ height: "80vh" }} verticalAlign="middle">
        <Grid.Column style={{ maxWidth: 450 }}>
          <Header textAlign="center">
            Register
          </Header>
          <Form>
            <Segment stacked>
              <Form.Input
                fluid
                icon="user"
                iconPosition="left"
                placeholder="Name"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <Form.Input
                fluid
                icon="mail"
                iconPosition="left"
                placeholder="E-mail address"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <Form.Input
                fluid
                icon="lock"
                iconPosition="left"
                placeholder="Password"
                type="password" value={password} onChange={e => setPassword(e.target.value)}
              />

              <Button
                fluid
                color="green"
                onClick={async () => {
                  try {
                    const { user } = await firebase.auth().createUserWithEmailAndPassword(email, password);
                    firebase.firestore().collection("users").add({
                      name: name,
                      user_id: user.uid,
                    });
                    history.push("/");
                  } catch (error) {
                    alert(`${error.code}\n\n${error.message}`);
                  }
                }}
              >
                Sign Up
              </Button>
            </Segment>
          </Form>
          <Message>
            Already registered? <Link to="/login">Login</Link>
          </Message>
        </Grid.Column>
      </Grid>
    </>
  );
}
