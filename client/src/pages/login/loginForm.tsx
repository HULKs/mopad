import * as React from "react";
import { FormattedMessage, InjectedIntl, injectIntl } from "react-intl";
import { ApolloError } from "apollo-client";
import TextField from "material-ui/TextField";
import RaisedButton from "material-ui/RaisedButton";
import { Card, CardText, CardTitle, CardActions } from "material-ui/Card";

interface LoginFormProps {
    error?: ApolloError;
    intl: InjectedIntl;

    onLogin(email: string, password: string): void;
    onSignUp(name: string, email: string, password: string): void;
}

interface LoginFormState {
    email: string;
    password: string;
    name?: string;
}

export class DisconnectedLoginForm extends React.Component<LoginFormProps, LoginFormState> {
    constructor(props) {
        super(props);
        this.handleLogin = this.handleLogin.bind(this);
        this.handleSignUp = this.handleSignUp.bind(this);
        this.state = {
            email: null,
            password: null
        };
    }

    public render() {
        return (
            <Card className="card login">
                <CardTitle>
                    <h1>
                        <FormattedMessage id="app.login.headline" />
                    </h1>
                </CardTitle>
                <CardText>
                    <TextField
                        id="name"
                        fullWidth
                        hintText={this.props.intl.formatMessage({
                            id: "app.login.name.hint"
                        })}
                        floatingLabelText={this.props.intl.formatMessage({
                            id: "app.login.name"
                        })}
                        onChange={(event, name) => this.setState({ name })}
                    />
                    <br />
                    <TextField
                        id="email"
                        fullWidth
                        hintText={this.props.intl.formatMessage({
                            id: "app.login.email.hint"
                        })}
                        floatingLabelText={this.props.intl.formatMessage({
                            id: "app.login.email"
                        })}
                        onChange={(event, email) => this.setState({ email })}
                    />
                    <br />
                    <TextField
                        id="password"
                        fullWidth
                        floatingLabelText={this.props.intl.formatMessage({
                            id: "app.login.password"
                        })}
                        onChange={(event, password) => this.setState({ password })}
                        type="password"
                    />
                </CardText>
                {this.renderError()}
                <CardActions>
                    <RaisedButton
                        primary
                        onClick={this.handleLogin}
                        label={this.props.intl.formatMessage({
                            id: "app.login.login_cta"
                        })}
                    />
                    <RaisedButton
                        onClick={this.handleSignUp}
                        label={this.props.intl.formatMessage({
                            id: "app.login.signup_cta"
                        })}
                    />
                </CardActions>
            </Card>
        );
    }

    private handleLogin() {
        this.props.onLogin(this.state.email, this.state.password);
    }

    private handleSignUp() {
        this.props.onSignUp(this.state.name, this.state.email, this.state.password);
    }

    private renderError() {
        if (!this.props.error) {
            return null;
        }

        const errorKeys = new Set();
        if (this.props.error.graphQLErrors) {
            errorKeys.add(
                this.props.error.graphQLErrors.map(err => err.functionError || "general")
            );
        }

        return (
            <CardText className="error">
                {[...errorKeys.values()].map(key => (
                    <FormattedMessage key={key} id={"app.login.error." + key} />
                ))}
            </CardText>
        );
    }
}

export default injectIntl(DisconnectedLoginForm);
