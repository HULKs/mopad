import React from "react";
import { Form, Image, Button, Container, Menu, Grid, Header, Segment, Message } from "semantic-ui-react";

export default function Login() {
    return (
        <>
            <Menu inverted>
                <Menu.Item header>
                    <Image size='mini' src='./logo.png' style={{ marginRight: '1em' }} />
                    MOPAD
                </Menu.Item>
            </Menu>
            <Grid textAlign='center' style={{ height: '80vh' }} verticalAlign='middle'>
                <Grid.Column style={{ maxWidth: 450 }}>
                    <Header as='h2' color='teal' textAlign='center'>
                        RoHOW
                    </Header>
                    <Form size='large'>
                        <Segment stacked>
                            <Form.Input fluid icon='user' iconPosition='left' placeholder='E-mail address' />
                            <Form.Input
                                fluid
                                icon='lock'
                                iconPosition='left'
                                placeholder='Password'
                                type='password'
                            />

                            <Button color='teal' fluid size='large'>
                                Login
                            </Button>
                        </Segment>
                    </Form>
                    <Message>
                        New to us? <a href='#'>Sign Up</a>
                    </Message>
                </Grid.Column>
            </Grid>
        </>
    );
}
