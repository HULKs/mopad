import * as React from "react";
import { FormattedMessage } from "react-intl";
import LoginForm from "./loginForm";
import { ISessionStore, LocalSessionStore } from "../../business/auth";
import gql from "graphql-tag";
import graphql from "react-apollo/graphql";
import { compose } from "react-apollo";
import { LoginMutation, SignupMutation } from "../../../mopad-graphql";
import { ApolloError, ApolloQueryResult } from "apollo-client";
import { RouterProps, withRouter } from "react-router";

export interface LoginPageProps extends RouterProps {
    doLogin(
        email: string,
        password: string
    ): Promise<ApolloQueryResult<LoginMutation>>;
    doSignUp(
        name: string,
        email: string,
        password: string
    ): Promise<ApolloQueryResult<SignupMutation>>;
}

export interface LoginPageState {
    error: ApolloError | string;
}

export class LoginPage extends React.Component<LoginPageProps, LoginPageState> {
    private sessionStore: ISessionStore;

    constructor(props: LoginPageProps) {
        super(props);

        this.handleLogin = this.handleLogin.bind(this);
        this.handleSignUp = this.handleSignUp.bind(this);

        this.sessionStore = new LocalSessionStore();

        this.state = {
            error: null
        };
    }

    public render() {
        return (
            <div className="page">
                <LoginForm
                    onLogin={this.handleLogin}
                    onSignUp={this.handleSignUp}
                    error={this.state.error}
                />
            </div>
        );
    }

    private async handleLogin(email: string, password: string) {
        try {
            const response = await this.props.doLogin(email, password);
            this.sessionStore.token = response.data.authenticateUser.token;
            this.sessionStore.userId = response.data.authenticateUser.id;
            this.sessionStore.userIsAdmin =
                response.data.authenticateUser.isAdmin;
            this.props.history.push("/");
        } catch (err) {
            this.setState({ error: err });
        }
    }

    private async handleSignUp(name: string, email: string, password: string) {
        try {
            const response = await this.props.doSignUp(name, email, password);
            this.sessionStore.token = response.data.signupUser.token;
            this.sessionStore.userId = response.data.signupUser.id;
            this.sessionStore.userIsAdmin = false;
            this.props.history.push("/");
        } catch (err) {
            this.setState({ error: err });
        }
    }
}

const LOGIN_MUTATION = gql`
    mutation Login($email: String!, $password: String!) {
        authenticateUser(email: $email, password: $password) {
            id
            isAdmin
            token
        }
    }
`;

const SIGNUP_MUTATION = gql`
    mutation Signup($name: String!, $email: String!, $password: String!) {
        signupUser(name: $name, email: $email, password: $password) {
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

const signupUser = graphql(SIGNUP_MUTATION, {
    props: ({ mutate, ownProps }) => ({
        ...ownProps,
        doSignUp: (name: string, email: string, password: string) =>
            mutate({ variables: { name, password, email } })
    })
});

export default compose(
    loginUser,
    signupUser,
    withRouter
)(LoginPage);
