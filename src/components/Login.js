import React from "react";
import {
  Form,
  Image,
  Button,
  Menu,
  Grid,
  Header,
  Segment,
  Message,
  Divider,
  Container
} from "semantic-ui-react";

export default function Login() {
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

      <Grid textAlign='center' style={{ height: '80vh' }} verticalAlign='middle'>
        <Grid.Column style={{ maxWidth: 450 }}>
          <Header textAlign='center'>
            Log-in to your account
      </Header>
          <Form >
            <Segment stacked>
              <Form.Input fluid icon='mail' iconPosition='left' placeholder='E-mail address' />
              <Form.Input
                fluid
                icon='lock'
                iconPosition='left'
                placeholder='Password'
                type='password'
              />

              <Button fluid color='green' href='/'>
                Login
              </Button>
            </Segment>
          </Form>
          <Message>
            New to us? <a href='/register'>Register</a>
          </Message>
        </Grid.Column>
      </Grid>

    </>
  );
}
