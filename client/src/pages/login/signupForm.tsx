import * as React from "react";
import { FormattedMessage, InjectedIntl, injectIntl } from "react-intl";
import { ApolloError } from "apollo-client";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import { Typography, Card, CardContent, CardActions } from "@material-ui/core";
import TeamSelector from "../../app/teamSelector";

interface LoginFormProps {
    errors?: string[];
    intl: InjectedIntl;

    onSignUp(name: string, email: string, password: string, teamId: string): void;
}

interface LoginFormState {
    email: string;
    password: string;
    name: string;
    teamId: string;
}

export class DisconnectedLoginForm extends React.Component<LoginFormProps, LoginFormState> {
    constructor(props) {
        super(props);
        this.handleSignUp = this.handleSignUp.bind(this);
        this.state = {
            email: null,
            password: null,
            name: "",
            teamId: null
        };
    }

    public render() {
        return (
            <Card className="card login">
                <CardContent>
                    <Typography component="h5" variant="h5">
                        <FormattedMessage id="app.signup.headline" />
                    </Typography>
                    <TextField
                        fullWidth
                        margin="normal"
                        placeholder={this.props.intl.formatMessage({
                            id: "app.signup.name.hint"
                        })}
                        label={this.props.intl.formatMessage({
                            id: "app.signup.name"
                        })}
                        onChange={event => this.setState({ name: event.target.value })}
                    />
                    <TeamSelector
                        label={this.props.intl.formatMessage({
                            id: "app.signup.team"
                        })}
                        value={this.state.teamId}
                        onChange={id => this.setState({ teamId: id })}
                    />
                    <TextField
                        fullWidth
                        margin="normal"
                        placeholder={this.props.intl.formatMessage({
                            id: "app.signup.email.hint"
                        })}
                        label={this.props.intl.formatMessage({
                            id: "app.signup.email"
                        })}
                        onChange={event => this.setState({ email: event.target.value })}
                    />
                    <TextField
                        fullWidth
                        margin="normal"
                        label={this.props.intl.formatMessage({
                            id: "app.signup.password"
                        })}
                        onChange={event => this.setState({ password: event.target.value })}
                        type="password"
                    />
                    {this.renderError()}
                </CardContent>
                <CardActions>
                    <Button color="primary" variant="contained" onClick={this.handleSignUp}>
                        {this.props.intl.formatMessage({
                            id: "app.signup.cta"
                        })}
                    </Button>
                </CardActions>
            </Card>
        );
    }

    private handleSignUp() {
        this.props.onSignUp(
            this.state.name,
            this.state.email,
            this.state.password,
            this.state.teamId
        );
    }

    private renderError() {
        const { errors } = this.props;

        if (!errors || errors.length == 0) {
            return null;
        }

        return (
            <Typography component="p" className="error">
                {errors.map(key => (
                    <FormattedMessage key={key} id={key} />
                ))}
            </Typography>
        );
    }
}

export default injectIntl(DisconnectedLoginForm);
