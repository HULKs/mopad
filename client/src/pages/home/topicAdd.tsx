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

interface PublicProps {
    intl: InjectedIntl;
}

interface State {
    dialogOpen: boolean;
    topicName: string;
}

export class TopicAdd extends React.Component<PublicProps, State> {
    constructor(props) {
        super(props);
        this.state = {
            dialogOpen: false,
            topicName: ""
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
                        value={this.state.topicName}
                        onChange={(e, val) => {
                            this.setState({ topicName: val });
                        }}
                    />
                </Dialog>
            </div>
        );
    }

    private handleClose() {
        this.setState({ dialogOpen: false, topicName: "" });
    }

    private handleSubmit() {
        this.setState({ dialogOpen: false, topicName: "" });
    }
}

export default injectIntl(TopicAdd);
