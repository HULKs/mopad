import * as React from "react";
import { injectIntl, InjectedIntl } from "react-intl";
import * as Moment from "moment";

import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import TextField from "@material-ui/core/TextField";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import LocationSelector from "../../app/locationSelector";
import { TopicViewModel, TopicUpdate } from "../../business/topics";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";

interface EditDialogProps {
    open: boolean;
    topic: TopicViewModel;
    onSubmit(update: TopicUpdate);
    onCancel();
}
interface IntlProps {
    intl: InjectedIntl;
}
interface EditDialogState {
    data: TopicUpdate;
    beginString: string;
}

export class DisconnectedEditDialog extends React.Component<
    EditDialogProps & IntlProps,
    EditDialogState
> {
    constructor(props: EditDialogProps & IntlProps) {
        super(props);
        const { topic } = props;
        const begin = topic.begin ? Moment(topic.begin).toDate() : null;

        this.state = {
            data: {
                id: topic.id,
                title: topic.title,
                description: topic.description || "",
                isTalk: topic.isTalk,
                begin: begin,
                locationId: topic.location ? topic.location.id : null
            },
            beginString: begin ? begin.toISOString() : ""
        };
        this.onSubmit = this.onSubmit.bind(this);
    }

    render() {
        const { open, onCancel, intl } = this.props;
        const { data, beginString } = this.state;

        const actions = [
            <Button color="primary" onClick={onCancel}>
                {intl.formatMessage({
                    id: "topic.edit.dialog.cancel"
                })}
            </Button>,
            <Button color="primary" onClick={this.onSubmit}>
                {intl.formatMessage({
                    id: "topic.edit.dialog.submit"
                })}
            </Button>
        ];
        return (
            <Dialog open={open} onClose={onCancel} fullScreen>
                <DialogTitle>
                    {this.props.intl.formatMessage({
                        id: "topic.edit.dialog.title"
                    })}
                </DialogTitle>
                <DialogContent>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={data.isTalk}
                                onChange={(e, checked) => {
                                    this.setState({
                                        data: { ...data, isTalk: checked }
                                    });
                                }}
                            />
                        }
                        label={this.props.intl.formatMessage({
                            id: "topic.edit.dialog.isTalk"
                        })}
                    />
                    <TextField
                        fullWidth
                        margin="normal"
                        label="Title"
                        value={data.title}
                        onChange={e => {
                            this.setState({
                                data: { ...data, title: e.target.value }
                            });
                        }}
                    />
                    <TextField
                        fullWidth
                        margin="normal"
                        multiline
                        label={"Description"}
                        value={data.description}
                        onChange={e => {
                            this.setState({
                                data: { ...data, description: e.target.value }
                            });
                        }}
                    />
                    <LocationSelector
                        label={"Select Location"}
                        value={data.locationId}
                        onChange={id =>
                            this.setState({
                                data: { ...data, locationId: id }
                            })
                        }
                    />
                    <TextField
                        fullWidth
                        margin="normal"
                        type="datetime-local"
                        label={"Select Date"}
                        InputLabelProps={{
                            shrink: true
                        }}
                        value={beginString}
                        onChange={e =>
                            this.setState({
                                beginString: e.target.value
                            })
                        }
                    />
                </DialogContent>
                <DialogActions>
                    <Button color="primary" onClick={onCancel}>
                        {intl.formatMessage({
                            id: "topic.edit.dialog.cancel"
                        })}
                    </Button>
                    <Button color="primary" onClick={this.onSubmit}>
                        {intl.formatMessage({
                            id: "topic.edit.dialog.submit"
                        })}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }

    private onSubmit() {
        this.props.onSubmit({
            ...this.state.data,
            begin: this.state.beginString ? new Date(this.state.beginString) : null
        });
    }
}

export default injectIntl<EditDialogProps>(DisconnectedEditDialog);
