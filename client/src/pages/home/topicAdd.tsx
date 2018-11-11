import * as React from "react";
import { Card, CardActions, CardHeader, CardMedia, CardTitle, CardText } from "material-ui/Card";
import FloatingActionButton from "material-ui/FloatingActionButton";
import FlatButton from "material-ui/FlatButton";
import Dialog from "material-ui/Dialog";
import TextField from "material-ui/TextField";
import ContentAdd from "material-ui/svg-icons/content/add";
import { FormattedMessage, InjectedIntl, injectIntl } from "react-intl";

const floatStyle = {
    position: "fixed",
    bottom: "5%",
    right: "5%",
    zIndex: 100
};

interface TopicAddProps {
    intl: InjectedIntl;
    onTopicAdd(title: string, description: string);
}

interface State {
    dialogOpen: boolean;
    topicTitle: string;
    topicDescription: string;
}

export class DisconnectedTopicAdd extends React.Component<TopicAddProps, State> {
    constructor(props) {
        super(props);
        this.state = {
            dialogOpen: false,
            topicTitle: "",
            topicDescription: ""
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
                            id: "topics.add.dialog.titleInput.hint"
                        })}
                        floatingLabelText={this.props.intl.formatMessage({
                            id: "topics.add.dialog.titleInput.label"
                        })}
                        value={this.state.topicTitle}
                        onChange={(e, val) => {
                            this.setState({ topicTitle: val });
                        }}
                    />
                    <TextField
                        fullWidth
                        multiLine
                        hintText={this.props.intl.formatMessage({
                            id: "topics.add.dialog.descriptionInput.hint"
                        })}
                        floatingLabelText={this.props.intl.formatMessage({
                            id: "topics.add.dialog.descriptionInput.label"
                        })}
                        value={this.state.topicDescription}
                        onChange={(e, val) => {
                            this.setState({ topicDescription: val });
                        }}
                    />
                </Dialog>
            </div>
        );
    }

    private handleClose() {
        this.setState({
            dialogOpen: false,
            topicTitle: "",
            topicDescription: ""
        });
    }

    private handleSubmit() {
        this.props.onTopicAdd(this.state.topicTitle, this.state.topicDescription);
        this.setState({
            dialogOpen: false,
            topicTitle: "",
            topicDescription: ""
        });
    }
}

export default injectIntl(DisconnectedTopicAdd);
