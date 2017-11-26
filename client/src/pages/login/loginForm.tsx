import * as React from "react";
import { FormattedMessage } from "react-intl";
import { ISessionStore } from "../../business/auth";
import gql from "graphql-tag";
import { LoginMutation } from "../../../mopad-graphql";
import graphql from "react-apollo/graphql";
import { ApolloQueryResult } from "apollo-client";

interface PublicProps {
    sessionStore: ISessionStore;
}

interface LoginFormProps {
    doLogin(
        email: string,
        password: string
    ): Promise<ApolloQueryResult<LoginMutation>>;
}

interface LoginFormState {
    email: string;
    password: string;
    showError: boolean;
}

export class DisconnectedLoginForm extends React.Component<
    LoginFormProps & PublicProps,
    LoginFormState
> {
    constructor(props) {
        super(props);
        this.handleLogin = this.handleLogin.bind(this);
        this.state = {
            email: null,
            password: null,
            showError: false
        };
    }

    public render() {
        return (
            <div>
                <label>
                    <FormattedMessage id="app.login.email" />
                    <input
                        id="email"
                        type="text"
                        onChange={e => this.setState({ email: e.target.value })}
                    />
                </label>
                <label>
                    <FormattedMessage id="app.login.password" />
                    <input
                        id="password"
                        type="password"
                        onChange={e =>
                            this.setState({ password: e.target.value })
                        }
                    />
                </label>
                <button type="submit" onClick={this.handleLogin}>
                    <FormattedMessage id="app.login.login_cta" />
                </button>
                {this.renderError()}
            </div>
        );
    }

    private async handleLogin() {
        try {
            const response = await this.props.doLogin(
                this.state.email,
                this.state.password
            );
            this.props.sessionStore.token =
                response.data.authenticateUser.token;
            this.props.sessionStore.userId = response.data.authenticateUser.id;
        } catch (err) {
            console.error("Error during login:", err);
            this.setState({ showError: true });
        }
    }

    private renderError() {
        if (!this.state.showError) {
            return null;
        }

        return (
            <div>
                <FormattedMessage id="app.login.error.message" />
            </div>
        );
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

export default graphql<LoginMutation, PublicProps, LoginFormProps>(
    LOGIN_MUTATION,
    {
        props: ({ mutate }) => ({
            doLogin: (email: string, password: string) =>
                mutate({ variables: { password, email } })
        })
    }
)(DisconnectedLoginForm);
