import * as React from "react";
import {
    Card,
    CardActions,
    CardHeader,
    CardMedia,
    CardTitle,
    CardText
} from "material-ui/Card";
import FloatingActionButton from "material-ui/FloatingActionButton";
import FlatButton from "material-ui/FlatButton";
import Dialog from "material-ui/Dialog";
import TextField from "material-ui/TextField";
import ContentAdd from "material-ui/svg-icons/content/add";
import { FormattedMessage, InjectedIntl, injectIntl } from "react-intl";

const floatStyle = {
    position: "fixed",
    bottom: "5%",
    right: "5%"
};

interface TopicAddProps {
    intl: InjectedIntl;
    onTopicAdd(title: string);
}

interface State {
    dialogOpen: boolean;
    topicTitle: string;
}

export class DisconnectedTopicAdd extends React.Component<
    TopicAddProps,
    State
> {
    constructor(props) {
        super(props);
        this.state = {
            dialogOpen: false,
            topicTitle: ""
        };
        this.handleClose = this.handleClose.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
    }

    public render() {
        const actions = [
            <FlatButton
                label={this.props.intl.formatMessage({
                    id: "topics.add.dialog.cancel"
                })}
                primary={true}
                onClick={this.handleClose}
            />,
            <FlatButton
                label={this.props.intl.formatMessage({
                    id: "topics.add.dialog.submit"
                })}
                primary={true}
                keyboardFocused={true}
                onClick={this.handleSubmit}
            />
        ];

        return (
            <div>
                <FloatingActionButton
                    style={floatStyle}
                    onClick={() => this.setState({ dialogOpen: true })}
                >
                    <ContentAdd />
                </FloatingActionButton>
                <Dialog
                    title={this.props.intl.formatMessage({
                        id: "topics.add.dialog.title"
                    })}
                    actions={actions}
                    open={this.state.dialogOpen}
                    onRequestClose={this.handleClose}
                >
                    <TextField
                        fullWidth
                        hintText={this.props.intl.formatMessage({
                            id: "topics.add.dialog.input.hint"
                        })}
                        floatingLabelText={this.props.intl.formatMessage({
                            id: "topics.add.dialog.input.label"
                        })}
                        value={this.state.topicTitle}
                        onChange={(e, val) => {
                            this.setState({ topicTitle: val });
                        }}
                    />
                </Dialog>
            </div>
        );
    }

    private handleClose() {
        this.setState({ dialogOpen: false, topicTitle: "" });
    }

    private handleSubmit() {
        this.props.onTopicAdd(this.state.topicTitle);
        this.setState({ dialogOpen: false, topicTitle: "" });
    }
}

export default injectIntl(DisconnectedTopicAdd);