import * as React from "react";
import { FormattedMessage } from "react-intl";
import LoginForm from "./loginForm";
import { ISessionStore, LocalSessionStore } from "../../business/auth";
import gql from "graphql-tag";
import graphql from "react-apollo/graphql";
import { compose } from "react-apollo";
import { LoginMutation } from "../../../mopad-graphql";
import { ApolloQueryResult } from "apollo-client";
import { Router, RouterProps, withRouter } from "react-router";

export interface LoginPageProps extends RouterProps {
    doLogin(
        email: string,
        password: string
    ): Promise<ApolloQueryResult<LoginMutation>>;
}

export class LoginPage extends React.Component<LoginPageProps> {
    private sessionStore: ISessionStore;

    constructor(props: LoginPageProps) {
        super(props);
        this.handleLogin = this.handleLogin.bind(this);
        this.sessionStore = new LocalSessionStore();
    }

    public render() {
        return (
            <div>
                <h1>
                    <FormattedMessage id="app.login.headline" />
                </h1>
                <LoginForm onLogin={this.handleLogin} />
            </div>
        );
    }

    private async handleLogin(email: string, password: string) {
        try {
            const response = await this.props.doLogin(email, password);
            this.sessionStore.token = response.data.authenticateUser.token;
            this.sessionStore.userId = response.data.authenticateUser.id;
            this.props.history.push("/");
        } catch (err) {
            console.error(err);
            this.setState({ error: err });
        }
    }
}

const LOGIN_MUTATION = gql`
    mutation Login($email: String!, $password: String!) {
        authenticateUser(email: $email, password: $password) {
            id
            token
        }
    }
`;

const loginUser = graphql(LOGIN_MUTATION, {
    props: ({ mutate, ownProps }) => ({
        ...ownProps,
        doLogin: (email: string, password: string) =>
            mutate({ variables: { password, email } })
    })
});

export default compose(loginUser, withRouter)(LoginPage);
