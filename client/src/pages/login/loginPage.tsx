import * as React from "react";
import { FormattedMessage } from "react-intl";
import LoginForm from "./loginForm";
import SignupForm from "./signupForm";
import { ISessionStore, LocalSessionStore } from "../../business/auth";
import gql from "graphql-tag";
import graphql from "react-apollo/graphql";
import { compose } from "react-apollo";
import { LoginMutation, SignupMutation } from "../../../mopad-graphql";
import { ApolloError, ApolloQueryResult } from "apollo-client";
import { RouterProps, withRouter } from "react-router";
import { Grid } from "@material-ui/core";

export interface LoginPageProps extends RouterProps {
    doLogin(email: string, password: string): Promise<ApolloQueryResult<LoginMutation>>;
    doSignUp(
        name: string,
        email: string,
        password: string,
        teamId: string
    ): Promise<ApolloQueryResult<SignupMutation>>;
}

export interface LoginPageState {
    loginErrors: string[];
    signupErrors: string[];
}

export class LoginPage extends React.Component<LoginPageProps, LoginPageState> {
    private sessionStore: ISessionStore;

    constructor(props: LoginPageProps) {
        super(props);

        this.handleLogin = this.handleLogin.bind(this);
        this.handleSignUp = this.handleSignUp.bind(this);

        this.sessionStore = new LocalSessionStore();

        this.state = {
            loginErrors: [],
            signupErrors: []
        };
    }

    public render() {
        return (
            <div className="page">
                <Grid container spacing={24}>
                    <Grid item xs={12} sm={6}>
                        <LoginForm onLogin={this.handleLogin} errors={this.state.loginErrors} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <SignupForm onSignUp={this.handleSignUp} errors={this.state.signupErrors} />
                    </Grid>
                </Grid>
            </div>
        );
    }

    private async handleLogin(email: string, password: string) {
        if (!email || !password) {
            this.setState({ loginErrors: ["app.login.error.missingFields"] });
            return;
        }
        try {
            const response = await this.props.doLogin(email, password);
            this.sessionStore.token = response.data.authenticateUser.token;
            this.sessionStore.userId = response.data.authenticateUser.id;
            this.sessionStore.userIsAdmin = response.data.authenticateUser.isAdmin;
            this.props.history.push("/");
        } catch (err) {
            const errorKeys: string[] = [];
            if (err.graphQLErrors) {
                err.graphQLErrors.map(err =>
                    errorKeys.push("app.login.error." + (err.functionError || "general"))
                );
            } else {
                errorKeys.push("app.login.error.general");
            }
            this.setState({ loginErrors: errorKeys });
        }
    }

    private async handleSignUp(name: string, email: string, password: string, teamId: string) {
        if (!name || !email || !password) {
            this.setState({ signupErrors: ["app.signup.error.missingFields"] });
            return;
        }
        try {
            const response = await this.props.doSignUp(name, email, password, teamId);
            this.sessionStore.token = response.data.signupUser.token;
            this.sessionStore.userId = response.data.signupUser.id;
            this.sessionStore.userIsAdmin = false;
            this.props.history.push("/");
        } catch (err) {
            const errorKeys: string[] = [];
            if (err.graphQLErrors) {
                err.graphQLErrors.map(err =>
                    errorKeys.push("app.login.error." + (err.functionError || "general"))
                );
            } else {
                errorKeys.push("app.login.error.general");
            }
            this.setState({ signupErrors: errorKeys });
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
    mutation Signup($name: String!, $email: String!, $password: String!, $teamId: ID!) {
        signupUser(name: $name, email: $email, password: $password, teamId: $teamId) {
            id
            token
        }
    }
`;

const loginUser = graphql(LOGIN_MUTATION, {
    props: ({ mutate, ownProps }) => ({
        ...ownProps,
        doLogin: (email: string, password: string) => mutate({ variables: { password, email } })
    })
});

const signupUser = graphql(SIGNUP_MUTATION, {
    props: ({ mutate, ownProps }) => ({
        ...ownProps,
        doSignUp: (name: string, email: string, password: string, teamId: string) =>
            mutate({ variables: { name, password, email, teamId } })
    })
});

export default compose(
    loginUser,
    signupUser,
    withRouter
)(LoginPage);
