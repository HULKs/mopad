import * as React from "react";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import TextField from "@material-ui/core/TextField";
import ContentAdd from "@material-ui/icons/Add";
import { FormattedMessage, InjectedIntl, injectIntl } from "react-intl";
import { CSSProperties } from "react";

const floatStyle: CSSProperties = {
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
        return (
            <div>
                <Button
                    variant="fab"
                    style={floatStyle}
                    onClick={() => this.setState({ dialogOpen: true })}
                >
                    <ContentAdd />
                </Button>
                <Dialog open={this.state.dialogOpen} onClose={this.handleClose}>
                    <DialogTitle>
                        {this.props.intl.formatMessage({
                            id: "topics.add.dialog.title"
                        })}
                    </DialogTitle>
                    <DialogContent>
                        <TextField
                            fullWidth
                            placeholder={this.props.intl.formatMessage({
                                id: "topics.add.dialog.titleInput.hint"
                            })}
                            label={this.props.intl.formatMessage({
                                id: "topics.add.dialog.titleInput.label"
                            })}
                            value={this.state.topicTitle}
                            onChange={e => {
                                this.setState({ topicTitle: e.target.value });
                            }}
                        />
                        <TextField
                            fullWidth
                            multiline
                            margin="normal"
                            placeholder={this.props.intl.formatMessage({
                                id: "topics.add.dialog.descriptionInput.hint"
                            })}
                            label={this.props.intl.formatMessage({
                                id: "topics.add.dialog.descriptionInput.label"
                            })}
                            value={this.state.topicDescription}
                            onChange={e => {
                                this.setState({ topicDescription: e.target.value });
                            }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button color="primary" onClick={this.handleClose}>
                            {this.props.intl.formatMessage({
                                id: "topics.add.dialog.cancel"
                            })}
                        </Button>
                        <Button color="primary" onClick={this.handleSubmit}>
                            {this.props.intl.formatMessage({
                                id: "topics.add.dialog.submit"
                            })}
                        </Button>
                    </DialogActions>
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
