import * as React from "react";
import { FormattedMessage, InjectedIntl, injectIntl } from "react-intl";
import { ApolloError } from "apollo-client";
import TextField from "material-ui/TextField";
import RaisedButton from "material-ui/RaisedButton";
import { Card, CardText, CardActions } from "material-ui/Card";

interface LoginFormProps {
    error?: ApolloError;
    intl: InjectedIntl;

    onLogin(email: string, password: string): void;
}

interface LoginFormState {
    email: string;
    password: string;
}

export class DisconnectedLoginForm extends React.Component<
    LoginFormProps,
    LoginFormState
> {
    constructor(props) {
        super(props);
        this.handleLogin = this.handleLogin.bind(this);
        this.state = {
            email: null,
            password: null
        };
    }

    public render() {
        return (
            <Card>
                <CardText>
                    <TextField
                        id="email"
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
                        floatingLabelText={this.props.intl.formatMessage({
                            id: "app.login.password"
                        })}
                        onChange={(event, password) =>
                            this.setState({ password })
                        }
                        type="password"
                    />
                </CardText>
                <CardActions>
                    <RaisedButton
                        primary
                        onClick={this.handleLogin}
                        label={this.props.intl.formatMessage({
                            id: "app.login.login_cta"
                        })}
                    />
                </CardActions>

                {this.renderError()}
            </Card>
        );
    }

    private async handleLogin() {
        this.props.onLogin(this.state.email, this.state.password);
    }

    private renderError() {
        if (!this.props.error) {
            return null;
        }

        return (
            <div className="error">
                <FormattedMessage id="app.login.error.message" />
            </div>
        );
    }
}

export default injectIntl(DisconnectedLoginForm);
